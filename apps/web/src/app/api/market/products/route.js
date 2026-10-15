import { readObject } from '@/lib/read-json.mjs';
import {auth} from '@/auth';
import sql from '@/app/api/utils/sql';
import { identity, fail, invalid } from '@/lib/api';
import { validProduct, validId } from '@/lib/market-validation.mjs';
import { allowAttempt } from '@/lib/throttle';
export async function GET(request) {
 if(!process.env.DATABASE_URL) return Response.json({ products:[], mode:'demo' });
 try {
  const session=await auth();const viewer=session?.user?.id||null;
  const search=(new URL(request.url).searchParams.get('q') || '').slice(0,120);
  const products=await sql`SELECT p.*,a.name AS seller_name FROM tx_products p JOIN tx_accounts a ON a.id=p.seller_id WHERE p.active AND NOT p.hidden AND a.status='active' AND NOT tx_blocked(p.seller_id,${viewer}::bigint) AND (p.name ILIKE ${'%'+search+'%'} OR p.category ILIKE ${'%'+search+'%'}) ORDER BY p.created_at DESC,p.id DESC LIMIT 60`;
  return Response.json({products,mode:'live'});
 } catch(e) { return fail(e); }
}
export async function POST(request) {
 try {
  const user=await identity(request,true);
  if(!await allowAttempt(request,`listing:${user.id}`,20)) return Response.json({error:'Try again later.'},{status:429});
  const body=await readObject(request);
  if(!validProduct(body)) return invalid('Use a title, description, valid price, stock, category, and artwork.');
  const [product]=await sql`INSERT INTO tx_products(seller_id,name,description,price_paise,stock,category,artwork) VALUES(${user.id},${body.name.trim()},${body.description.trim()},${body.price_paise},${body.stock},${body.category},${body.artwork}) RETURNING *`;
  return Response.json({product},{status:201});
 } catch(e) { return fail(e); }
}
export async function PUT(request) {
 try {
  const user=await identity(request,true); const body=await readObject(request);
  if(!validId(body.id) || !validProduct(body) || typeof body.active!=='boolean' || !Number.isInteger(body.version) || body.version<1) return invalid();
  const [product]=await sql`UPDATE tx_products SET name=${body.name.trim()},description=${body.description.trim()},price_paise=${body.price_paise},stock=${body.stock},category=${body.category},artwork=${body.artwork},active=${body.active},version=version+1 WHERE id=${body.id} AND seller_id=${user.id} AND version=${body.version} RETURNING *`;
  if(!product) return Response.json({error:'Listing changed or is not yours. Refresh before editing.'},{status:409});
  return Response.json({product});
 } catch(e) { return fail(e); }
}
