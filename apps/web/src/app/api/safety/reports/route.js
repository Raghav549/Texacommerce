import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
import {validId} from '@/lib/market-validation.mjs';
import {allowAttempt} from '@/lib/throttle';
export async function POST(request){try{
 const user=await identity(request,true);const {kind,targetId,reason}=await readObject(request);
 if(!['post','comment','product','account'].includes(kind)||!validId(targetId)||typeof reason!=='string'||reason.trim().length<5||reason.length>1000)return invalid('Describe the concern in 5–1,000 characters.');
 if(!await allowAttempt(request,`report:${user.id}`,20))return Response.json({error:'Please try again later.'},{status:429});
 const [target]=await sql`SELECT id FROM (SELECT 'post' AS kind,id FROM tx_posts UNION ALL SELECT 'comment',id FROM tx_comments UNION ALL SELECT 'product',id FROM tx_products UNION ALL SELECT 'account',id FROM tx_accounts) targets WHERE kind=${kind} AND id=${targetId}`;
 if(!target)return Response.json({error:'Content not found.'},{status:404});
 await sql`INSERT INTO tx_reports(reporter_id,kind,target_id,reason) VALUES(${user.id},${kind},${targetId},${reason.trim()}) ON CONFLICT(reporter_id,kind,target_id) DO NOTHING`;
 return Response.json({success:true,message:'Your report is in the moderation queue.'},{status:201});
}catch(e){return fail(e);}}
