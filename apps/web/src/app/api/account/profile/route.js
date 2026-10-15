import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
export async function GET(request) {
 try {
  const user=await identity(request);
  const [profile]=await sql`SELECT id,name,email,bio,role,created_at,(SELECT count(*)::int FROM tx_posts WHERE author_id=tx_accounts.id AND NOT hidden) AS posts,(SELECT count(*)::int FROM tx_follows WHERE follower_id=tx_accounts.id) AS following,(SELECT count(*)::int FROM tx_follows WHERE following_id=tx_accounts.id) AS followers FROM tx_accounts WHERE id=${user.id} AND status='active'`;
  return Response.json({profile});
 } catch(e){return fail(e);}
}
export async function PUT(request) {
 try {
  const user=await identity(request,true);const {name,bio}=await readObject(request);
  if(typeof name!=='string'||name.trim().length<2||name.length>80||typeof bio!=='string'||bio.length>500)return invalid('Use a name of 2–80 characters and a bio of up to 500 characters.');
  const [profile]=await sql`UPDATE tx_accounts SET name=${name.trim()},bio=${bio.trim()} WHERE id=${user.id} AND status='active' RETURNING id,name,bio,email,role`;
  return Response.json({profile});
 }catch(e){return fail(e);}
}
