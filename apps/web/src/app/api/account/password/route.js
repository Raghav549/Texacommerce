import {hash,verify} from 'argon2';
import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
import {allowAttempt} from '@/lib/throttle';
export async function PUT(request) {
 try {
  const user=await identity(request,true);const {currentPassword,newPassword}=await readObject(request);
  if(typeof currentPassword!=='string'||currentPassword.length>128||typeof newPassword!=='string'||newPassword.length<12||newPassword.length>128)return invalid('Use your current password and a new password of 12–128 characters.');
  if(!await allowAttempt(request,`password:${user.id}`,5))return Response.json({error:'Please try again later.'},{status:429});
  const [account]=await sql`SELECT password_hash FROM tx_accounts WHERE id=${user.id} AND status='active'`;
  if(!account||!await verify(account.password_hash,currentPassword))return Response.json({error:'Current password is incorrect.'},{status:403});
  const nextHash=await hash(newPassword);
  await sql`SELECT tx_change_password(${user.id}::bigint,${user.sessionVersion}::integer,${account.password_hash},${nextHash})`;
  return Response.json({success:true,signInAgain:true});
 }catch(e){return fail(e);}
}
