import { readObject } from '@/lib/read-json.mjs';
import { auth } from '@/auth';
import sql from '@/app/api/utils/sql';
import { allowAttempt } from '@/lib/throttle';
import { validPost } from '@/lib/validation.mjs';
import { validId } from '@/lib/market-validation.mjs';
import { identity,fail,invalid } from '@/lib/api';
export async function GET(request) {
 if(!process.env.DATABASE_URL) return Response.json({posts:[],mode:'demo'});
 try {
  const session=await auth(); const userId=session?.user?.id || null;
  const following=new URL(request.url).searchParams.get('following')==='true';
  const posts=await sql`SELECT p.id,p.author_id,p.body,p.created_at,a.name,
   (SELECT count(*)::integer FROM tx_post_likes l WHERE l.post_id=p.id) AS likes,
   (SELECT count(*)::integer FROM tx_comments c WHERE c.post_id=p.id AND NOT c.hidden) AS comments,
   EXISTS(SELECT 1 FROM tx_post_likes l WHERE l.post_id=p.id AND l.user_id=${userId}) AS liked,
   EXISTS(SELECT 1 FROM tx_follows f WHERE f.follower_id=${userId} AND f.following_id=p.author_id) AS following
   FROM tx_posts p JOIN tx_accounts a ON a.id=p.author_id
   WHERE tx_visible_post(p.id,${userId}::bigint) AND (NOT ${following} OR p.author_id IN (SELECT following_id FROM tx_follows WHERE follower_id=${userId}))
   ORDER BY p.created_at DESC,p.id DESC LIMIT 50`;
  return Response.json({posts,mode:'live'});
 } catch(e) { return fail(e); }
}
export async function POST(request) {
 try {
  const user=await identity(request,true);
  if(!await allowAttempt(request,`publish:${user.id}`,20)) return Response.json({error:'Please try again later.'},{status:429});
  const {body}=await readObject(request); if(!validPost(body)) return invalid('Write between 1 and 2,000 characters.');
  const [post]=await sql`INSERT INTO tx_posts(author_id,body) VALUES(${user.id},${body.trim()}) RETURNING id,author_id,body,created_at`;
  return Response.json({post:{...post,name:user.name,likes:0,comments:0,liked:false,following:false}},{status:201});
 } catch(e) { return fail(e); }
}
export async function DELETE(request) {
 try {
  const user=await identity(request,true); const {id}=await readObject(request); if(!validId(id)) return invalid();
  const result=await sql`DELETE FROM tx_posts WHERE id=${id} AND author_id=${user.id} RETURNING id`;
  return result.length?Response.json({success:true}):Response.json({error:'Post not found.'},{status:404});
 } catch(e) { return fail(e); }
}
