import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
import {validId} from '@/lib/market-validation.mjs';
export async function GET(request){try{
 const user=await identity(request);const notifications=await sql`SELECT n.*,a.name AS actor_name FROM tx_notifications n LEFT JOIN tx_accounts a ON a.id=n.actor_id WHERE n.user_id=${user.id} AND (n.actor_id IS NULL OR NOT tx_blocked(n.actor_id,${user.id}::bigint)) ORDER BY n.id DESC LIMIT 100`;
 return Response.json({notifications});
}catch(e){return fail(e);}}
export async function PATCH(request){try{
 const user=await identity(request,true);const {id}=await readObject(request);if(!validId(id))return invalid();
 await sql`UPDATE tx_notifications SET read_at=now() WHERE user_id=${user.id} AND id=${id}`;return Response.json({success:true});
}catch(e){return fail(e);}}
