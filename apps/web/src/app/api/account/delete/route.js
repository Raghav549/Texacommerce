import {verify} from 'argon2';
import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
import {allowAttempt} from '@/lib/throttle';
export async function POST(request){
 try{
  const user=await identity(request,true);const {password,confirmation}=await readObject(request);
  if(typeof password!=='string'||password.length>128||confirmation!=='DELETE')return invalid('Enter your password and type DELETE to confirm.');
  if(!await allowAttempt(request,`delete:${user.id}`,5))return Response.json({error:'Please try again later.'},{status:429});
  const [account]=await sql`SELECT password_hash FROM tx_accounts WHERE id=${user.id} AND status='active'`;
  if(!account||!await verify(account.password_hash,password))return Response.json({error:'Password is incorrect.'},{status:403});
  await sql`SELECT tx_delete_account(${user.id}::bigint,${user.sessionVersion}::integer)`;
  return Response.json({success:true});
 }catch(e){return fail(e);}
}
