import { readObject } from '@/lib/read-json.mjs';
import sql from '@/app/api/utils/sql';
import { identity,fail,invalid } from '@/lib/api';
import { validId } from '@/lib/market-validation.mjs';
export async function GET(request) {
 try {
  const user=await identity(request);
  const items=await sql`SELECT c.quantity,p.*,a.name AS seller_name,(p.active AND NOT p.hidden AND a.status='active' AND NOT tx_blocked(p.seller_id,${user.id}::bigint)) AS available FROM tx_cart c JOIN tx_products p ON p.id=c.product_id JOIN tx_accounts a ON a.id=p.seller_id WHERE c.user_id=${user.id} ORDER BY p.id`;
  return Response.json({items,total_paise:items.reduce((s,p)=>s+p.quantity*p.price_paise,0)});
 } catch(e) { return fail(e); }
}
export async function PUT(request) {
 try {
  const user=await identity(request,true); const {productId,quantity}=await readObject(request);
  if(!validId(productId) || !Number.isInteger(quantity) || quantity<0 || quantity>20) return invalid();
  await sql`SELECT tx_set_cart(${user.id}::bigint,${productId}::bigint,${quantity}::integer)`;
  return Response.json({success:true});
 } catch(e) { return fail(e); }
}
