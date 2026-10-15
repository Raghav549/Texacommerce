import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
import {validId} from '@/lib/market-validation.mjs';
export async function GET(request){try{
 const user=await identity(request);if(user.role!=='admin')return Response.json({error:'Administrator access required.'},{status:403});
 const reports=await sql`SELECT r.*,a.name AS reporter_name,CASE r.kind WHEN 'post' THEN (SELECT body FROM tx_posts WHERE id=r.target_id) WHEN 'comment' THEN (SELECT body FROM tx_comments WHERE id=r.target_id) WHEN 'product' THEN (SELECT name||': '||description FROM tx_products WHERE id=r.target_id) ELSE (SELECT name||': '||bio FROM tx_accounts WHERE id=r.target_id) END AS content FROM tx_reports r JOIN tx_accounts a ON a.id=r.reporter_id WHERE r.status='open' ORDER BY r.created_at LIMIT 100`;
 const audit=await sql`SELECT id,report_id,action,created_at FROM tx_moderation_audit ORDER BY id DESC LIMIT 100`;
 return Response.json({reports,audit});
}catch(e){return fail(e);}}
export async function POST(request){try{
 const user=await identity(request,true);if(user.role!=='admin')return Response.json({error:'Administrator access required.'},{status:403});
 const {id,action}=await readObject(request);if(!validId(id)||!['hide','suspend','dismiss','restore'].includes(action))return invalid();
 await sql`SELECT tx_moderate(${user.id}::bigint,${id}::bigint,${action})`;return Response.json({success:true});
}catch(e){return fail(e);}}
