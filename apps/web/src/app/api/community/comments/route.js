import { readObject } from '@/lib/read-json.mjs';
import {auth} from '@/auth';
import sql from '@/app/api/utils/sql';
import { identity,fail,invalid } from '@/lib/api';
import { validId } from '@/lib/market-validation.mjs';
import { allowAttempt } from '@/lib/throttle';
export async function GET(request) {
 if(!process.env.DATABASE_URL) return Response.json({comments:[]});
 try {
  const postId=new URL(request.url).searchParams.get('postId'); if(!validId(postId)) return invalid();
  const session=await auth(); const viewer=session?.user?.id||null;
  const comments=await sql`SELECT c.id,c.user_id,c.body,c.created_at,a.name FROM tx_comments c JOIN tx_accounts a ON a.id=c.user_id WHERE c.post_id=${postId} AND NOT c.hidden AND a.status='active' AND tx_visible_post(c.post_id,${viewer}::bigint) AND NOT tx_blocked(c.user_id,${viewer}::bigint) ORDER BY c.created_at DESC,c.id DESC LIMIT 100`;
  return Response.json({comments});
 } catch(e) { return fail(e); }
}
export async function POST(request) {
 try {
  const user=await identity(request,true); const {postId,body}=await readObject(request);
  if(!validId(postId) || typeof body!=='string' || !body.trim() || body.length>1000) return invalid('Write a comment of 1–1,000 characters.');
  if(!await allowAttempt(request,`comment:${user.id}`,30)) return Response.json({error:'Please slow down.'},{status:429});
  const [comment]=await sql`INSERT INTO tx_comments(post_id,user_id,body) SELECT id,${user.id},${body.trim()} FROM tx_posts WHERE id=${postId} AND tx_visible_post(id,${user.id}::bigint) RETURNING *`;
  if(!comment) return Response.json({error:'Post not found.'},{status:404});
  return Response.json({comment:{...comment,name:user.name}},{status:201});
 } catch(e) { return fail(e); }
}
export async function DELETE(request) {
 try {
  const user=await identity(request,true); const {id}=await readObject(request); if(!validId(id)) return invalid();
  const result=await sql`DELETE FROM tx_comments WHERE id=${id} AND user_id=${user.id} RETURNING id`;
  return result.length?Response.json({success:true}):Response.json({error:'Comment not found.'},{status:404});
 } catch(e) { return fail(e); }
}
