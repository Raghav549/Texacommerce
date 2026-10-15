import { readObject } from '@/lib/read-json.mjs';
import sql from '@/app/api/utils/sql';
import { identity,fail,invalid } from '@/lib/api';
import { validId } from '@/lib/market-validation.mjs';
import { allowAttempt } from '@/lib/throttle';
export async function PUT(request) {
 try {
  const user=await identity(request,true); const {kind,targetId,enabled}=await readObject(request);
  if(!['like','follow'].includes(kind) || !validId(targetId) || typeof enabled!=='boolean' || (kind==='follow' && targetId===String(user.id))) return invalid();
  if(!await allowAttempt(request,`interaction:${user.id}`,120)) return Response.json({error:'Please slow down.'},{status:429});
  if(kind==='like') {
   const [post]=await sql`SELECT id FROM tx_posts WHERE id=${targetId}`;
   if(!post) return Response.json({error:'Post not found.'},{status:404});
   if(enabled) await sql`INSERT INTO tx_post_likes(post_id,user_id) VALUES(${targetId},${user.id}) ON CONFLICT DO NOTHING`;
   else await sql`DELETE FROM tx_post_likes WHERE post_id=${targetId} AND user_id=${user.id}`;
  } else {
   const [account]=await sql`SELECT id FROM tx_accounts WHERE id=${targetId}`;
   if(!account) return Response.json({error:'Person not found.'},{status:404});
   if(enabled) await sql`INSERT INTO tx_follows(follower_id,following_id) VALUES(${user.id},${targetId}) ON CONFLICT DO NOTHING`;
   else await sql`DELETE FROM tx_follows WHERE follower_id=${user.id} AND following_id=${targetId}`;
  }
  return Response.json({success:true});
 } catch(e) { return fail(e); }
}
