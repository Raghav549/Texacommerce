import { readObject } from '@/lib/read-json.mjs';
import sql from '@/app/api/utils/sql';
import { identity,fail,invalid } from '@/lib/api';
import { validShipping,validKey,validId } from '@/lib/market-validation.mjs';
import { allowAttempt } from '@/lib/throttle';
export async function POST(request) {
 try {
  const user=await identity(request,true);
  if(process.env.MARKETPLACE_COD_ENABLED!=='true') return Response.json({error:'Ordering is not enabled by the marketplace operator.'},{status:503});
  const {shipping,requestKey,items}=await readObject(request);
  if(!validShipping(shipping) || !validKey(requestKey) || !Array.isArray(items) || items.length<1 || items.length>50 || items.some(i=>!i || !validId(i.productId) || !Number.isInteger(i.quantity) || i.quantity<1 || i.quantity>20 || !Number.isInteger(i.unit_paise) || i.unit_paise<100 || i.unit_paise>100000000)) return invalid('Use a complete delivery address and a valid request key.');
  if(!await allowAttempt(request,`checkout:${user.id}`,20)) return Response.json({error:'Try again later.'},{status:429});
  const [result]=await sql`SELECT tx_checkout(${user.id}::bigint,${requestKey}::uuid,${JSON.stringify(shipping)}::jsonb,${JSON.stringify(items)}::jsonb) AS checkout_id`;
  const orders=await sql`SELECT id,total_paise,status,payment_method FROM tx_orders WHERE checkout_id=${result.checkout_id} AND buyer_id=${user.id} ORDER BY id`;
  return Response.json({orders,checkoutId:result.checkout_id});
 } catch(e) { return fail(e); }
}
