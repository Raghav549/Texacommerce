import {verify} from 'argon2';
import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
import {allowAttempt} from '@/lib/throttle';
export async function POST(request){
 try{
  const user=await identity(request,true);const {password}=await readObject(request);
  if(typeof password!=='string'||password.length>128)return invalid();
  if(!await allowAttempt(request,`revoke:${user.id}`,5))return Response.json({error:'Please try again later.'},{status:429});
  const [account]=await sql`SELECT password_hash FROM tx_accounts WHERE id=${user.id} AND status='active'`;
  if(!account||!await verify(account.password_hash,password))return Response.json({error:'Password is incorrect.'},{status:403});
  await sql`UPDATE tx_accounts SET session_version=session_version+1 WHERE id=${user.id}`;
  return Response.json({success:true});
 }catch(e){return fail(e);}
}
