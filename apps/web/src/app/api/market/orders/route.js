import { readObject } from '@/lib/read-json.mjs';
import sql from '@/app/api/utils/sql';
import { identity,fail,invalid } from '@/lib/api';
import { validId } from '@/lib/market-validation.mjs';
export async function GET(request) {
 try {
  const user=await identity(request);
  const orders=await sql`SELECT o.*,a.name AS seller_name,(SELECT json_agg(json_build_object('name',i.name,'quantity',i.quantity,'unit_paise',i.unit_paise)) FROM tx_order_items i WHERE i.order_id=o.id) AS items FROM tx_orders o JOIN tx_accounts a ON a.id=o.seller_id WHERE o.buyer_id=${user.id} ORDER BY o.created_at DESC LIMIT 100`;
  return Response.json({orders});
 } catch(e) { return fail(e); }
}
export async function PATCH(request) {
 try {
  const user=await identity(request,true); const {id,status}=await readObject(request);
  if(!validId(id) || !['accepted','shipped','delivered','cancelled'].includes(status)) return invalid();
  await sql`SELECT tx_order_status(${user.id}::bigint,${id}::bigint,${status}::text)`;
  return Response.json({success:true});
 } catch(e) { return fail(e); }
}
