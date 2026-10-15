import {after} from 'next/server';
import {randomBytes,createHash} from 'node:crypto';
import {hash} from 'argon2';
import sql from '@/app/api/utils/sql';
import {sameOrigin} from '@/lib/validation.mjs';
import {readObject} from '@/lib/read-json.mjs';
import {allowAttempt} from '@/lib/throttle';
import {fail,invalid} from '@/lib/api';
export async function POST(request){
 if(!sameOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});
 if(!process.env.DATABASE_URL||!process.env.AUTH_SECRET||!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM||!process.env.AUTH_URL)return Response.json({error:'Email recovery is not configured.'},{status:503});
 try{
  const body=await readObject(request);
  if(!await allowAttempt(request,'recovery',5))return Response.json({error:'Please try again later.'},{status:429});
  if(body.action==='request'){
   if(typeof body.email!=='string'||body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))return invalid('Enter a valid email.');
   const email=body.email.trim().toLowerCase();
   const emailBucket=createHash('sha256').update(email+process.env.AUTH_SECRET).digest('hex');
   if(!await allowAttempt(request,`recovery-email:${emailBucket}`,3))return Response.json({message:'If an active account exists for this address, a reset link will be sent. Check your inbox.'});
   // Same response and deferred work for registered/unregistered addresses.
   after(async()=>{
    try{
     const [account]=await sql`SELECT id FROM tx_accounts WHERE email=${email} AND status='active'`;
     if(!account)return;
     const token=randomBytes(32).toString('hex');const digest=createHash('sha256').update(token).digest('hex');
     await sql`DELETE FROM tx_password_tokens WHERE expires_at<now() OR (user_id=${account.id} AND used)`;
     await sql`INSERT INTO tx_password_tokens(token_hash,user_id,expires_at) VALUES(${digest},${account.id},now()+interval '30 minutes')`;
     const url=new URL('/',process.env.AUTH_URL);url.hash=`reset=${token}`;
     if(url.protocol!=='https:')throw new Error('Recovery requires an HTTPS AUTH_URL');
     const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:'Reset your Texa password',text:`A password reset was requested for your Texa account. Open this link within 30 minutes: ${url.toString()}\n\nIf this was not you, ignore this email. No password has changed.`}),signal:AbortSignal.timeout(10000)});
     if(!response.ok)console.error('Recovery email delivery failed',response.status);
    }catch{console.error('Recovery delivery task failed');}
   });
   return Response.json({message:'If an active account exists for this address, a reset link will be sent. Check your inbox.'});
  }
  if(body.action==='reset'){
   if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)||typeof body.password!=='string'||body.password.length<12||body.password.length>128)return invalid('Use a valid link and a password of 12–128 characters.');
   const digest=createHash('sha256').update(body.token).digest('hex'),passwordHash=await hash(body.password);
   await sql`SELECT tx_reset_password(${digest},${passwordHash})`;
   return Response.json({success:true,message:'Password changed. Sign in with your new password.'});
  }
  return invalid();
 }catch(e){return fail(e);}
}
