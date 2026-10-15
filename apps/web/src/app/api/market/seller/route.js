import sql from '@/app/api/utils/sql';
import { identity,fail } from '@/lib/api';
export async function GET(request) {
 try {
  const user=await identity(request);
  const [products,orders]=await Promise.all([
   sql`SELECT * FROM tx_products WHERE seller_id=${user.id} ORDER BY created_at DESC LIMIT 100`,
   sql`SELECT o.*,(SELECT json_agg(json_build_object('name',i.name,'quantity',i.quantity,'unit_paise',i.unit_paise)) FROM tx_order_items i WHERE i.order_id=o.id) AS items FROM tx_orders o WHERE seller_id=${user.id} ORDER BY created_at DESC LIMIT 100`
  ]);
  return Response.json({products,orders});
 } catch(e) { return fail(e); }
}
