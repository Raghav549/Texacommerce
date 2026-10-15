import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { splitSql } from '../src/lib/split-sql.mjs';
let db;
before(async()=>{
 db=new PGlite();
 for(const file of ['001_community.sql','002_market_social.sql','003_safety_accounts.sql','004_inbox.sql']) {
  const source=await readFile(new URL(`../migrations/${file}`,import.meta.url),'utf8');
  for(const statement of splitSql(source)) await db.exec(statement);
 }
 await db.exec(`INSERT INTO tx_accounts(name,email,password_hash) VALUES('Buyer','buyer@example.com','test'),('Seller','seller@example.com','test'),('Other Seller','other@example.com','test'),('Stranger','stranger@example.com','test');`);
});
after(async()=>{await db.close();});
async function query(sql,params=[]) {return (await db.query(sql,params)).rows;}
async function product(stock=3,seller=2) {
 const [p]=await query(`INSERT INTO tx_products(seller_id,name,description,price_paise,stock,category) VALUES($1,'Handmade cup','A lovely handmade ceramic cup.',99900,$2,'Home & living') RETURNING id`,[seller,stock]); return p.id;
}
const shipping=JSON.stringify({name:'Test Buyer',address:'123 Example Road, Gaya, Bihar',phone:'+919999999999',postal:'823001'});
async function checkout(key,expected) {
 const items=expected || await query('SELECT p.id::text AS "productId",c.quantity,p.price_paise AS unit_paise FROM tx_cart c JOIN tx_products p ON p.id=c.product_id WHERE c.user_id=1');
 return query('SELECT tx_checkout(1,$1::uuid,$2::jsonb,$3::jsonb) AS id',[key,shipping,JSON.stringify(items)]);
}
test('SQL splitter preserves functions and quoted semicolons',()=>{
 assert.deepEqual(splitSql("-- comment\nSELECT ';'; CREATE FUNCTION x() RETURNS void AS $$ BEGIN PERFORM 1; END $$ LANGUAGE plpgsql;"),["SELECT ';'","CREATE FUNCTION x() RETURNS void AS $$ BEGIN PERFORM 1; END $$ LANGUAGE plpgsql"]);
});
test('checkout is server-priced, multi-seller, atomic and idempotent',async()=>{
 const a=await product(4),b=await product(5,3);
 await query('SELECT tx_set_cart(1,$1,2)',[a]); await query('SELECT tx_set_cart(1,$1,1)',[b]);
 const key='11111111-1111-4111-8111-111111111111';
 const [result]=await checkout(key); const orders=await query('SELECT * FROM tx_orders WHERE checkout_id=$1',[result.id]);
 assert.equal(orders.length,2); assert.equal(orders.reduce((sum,o)=>sum+Number(o.total_paise),0),299700);
 assert.equal((await query('SELECT stock FROM tx_products WHERE id=$1',[a]))[0].stock,2);
 assert.equal((await query('SELECT * FROM tx_cart WHERE user_id=1')).length,0);
 assert.equal((await checkout(key))[0].id,result.id);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_orders WHERE checkout_id=$1',[result.id]))[0].n,2);
});
test('stock failure rolls back orders and leaves cart untouched',async()=>{
 const a=await product(2); await query('SELECT tx_set_cart(1,$1,2)',[a]);
 await query('UPDATE tx_products SET stock=1 WHERE id=$1',[a]);
 const before=(await query('SELECT count(*)::int AS n FROM tx_orders'))[0].n;
 await assert.rejects(checkout('22222222-2222-4222-8222-222222222222'),/INSUFFICIENT_STOCK/);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_orders'))[0].n,before);
 assert.equal((await query('SELECT quantity FROM tx_cart WHERE user_id=1 AND product_id=$1',[a]))[0].quantity,2);
 await query('SELECT tx_set_cart(1,$1,0)',[a]);
});
test('cart rejects own listings, invalid quantity and unavailable products',async()=>{
 const a=await product(3,1); await assert.rejects(query('SELECT tx_set_cart(1,$1,1)',[a]),/OWN_PRODUCT/);
 await assert.rejects(query('SELECT tx_set_cart(1,$1,21)',[a]),/INVALID_QUANTITY/);
 await assert.rejects(query('SELECT tx_set_cart(1,999999,1)'),/PRODUCT_UNAVAILABLE/);
});
test('order ownership, transitions and one-time stock restoration',async()=>{
 const a=await product(3); await query('SELECT tx_set_cart(1,$1,2)',[a]);
 const [{id}]=await checkout('33333333-3333-4333-8333-333333333333');
 const [order]=await query('SELECT id FROM tx_orders WHERE checkout_id=$1',[id]);
 await assert.rejects(query("SELECT tx_order_status(4,$1,'cancelled')",[order.id]),/ORDER_NOT_FOUND/);
 await assert.rejects(query("SELECT tx_order_status(1,$1,'accepted')",[order.id]),/INVALID_TRANSITION/);
 await query("SELECT tx_order_status(2,$1,'accepted')",[order.id]);
 await query("SELECT tx_order_status(1,$1,'cancelled')",[order.id]);
 await query("SELECT tx_order_status(1,$1,'cancelled')",[order.id]);
 assert.equal((await query('SELECT stock FROM tx_products WHERE id=$1',[a]))[0].stock,3);
 await assert.rejects(query("SELECT tx_order_status(2,$1,'shipped')",[order.id]),/INVALID_TRANSITION/);
});
test('social constraints make likes/follows idempotent and cascade post deletion',async()=>{
 const [{id}]=await query("INSERT INTO tx_posts(author_id,body) VALUES(2,'Hello community') RETURNING id");
 for(let i=0;i<2;i++) await query('INSERT INTO tx_post_likes(post_id,user_id) VALUES($1,1) ON CONFLICT DO NOTHING',[id]);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_post_likes WHERE post_id=$1',[id]))[0].n,1);
 await assert.rejects(query('INSERT INTO tx_follows VALUES(1,1)'),/check constraint/);
 await query("INSERT INTO tx_comments(post_id,user_id,body) VALUES($1,1,'A nice thought')",[id]);
 assert.equal((await query('DELETE FROM tx_posts WHERE id=$1 AND author_id=1 RETURNING id',[id])).length,0);
 await query('DELETE FROM tx_posts WHERE id=$1 AND author_id=2',[id]);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_comments WHERE post_id=$1',[id]))[0].n,0);
});
test('stale seller inventory edits cannot overwrite a checkout',async()=>{
 const a=await product(3);const [original]=await query('SELECT * FROM tx_products WHERE id=$1',[a]);
 await query('SELECT tx_set_cart(1,$1,1)',[a]);await checkout('44444444-4444-4444-8444-444444444444');
 const changed=await query('UPDATE tx_products SET stock=3,version=version+1 WHERE id=$1 AND seller_id=2 AND version=$2 RETURNING id',[a,original.version]);
 assert.equal(changed.length,0);assert.equal((await query('SELECT stock FROM tx_products WHERE id=$1',[a]))[0].stock,2);
 const stranger=await query('UPDATE tx_products SET stock=50 WHERE id=$1 AND seller_id=4 RETURNING id',[a]);assert.equal(stranger.length,0);
});
test('shipping and empty bag validation happens inside the database',async()=>{
 await assert.rejects(query("SELECT tx_checkout(4,'55555555-5555-4555-8555-555555555555','{}','[]')"),/EMPTY_CART/);
 const a=await product(1);await query('SELECT tx_set_cart(1,$1,1)',[a]);
 await assert.rejects(query("SELECT tx_checkout(1,'55555555-5555-4555-8555-555555555555','{}','[]')"),/INVALID_SHIPPING/);
 await query('SELECT tx_set_cart(1,$1,0)',[a]);
});

test('a changed price requires fresh customer consent before checkout',async()=>{
 const a=await product(2);await query('SELECT tx_set_cart(1,$1,1)',[a]);
 const accepted=[{productId:String(a),quantity:1,unit_paise:99900}];
 await query('UPDATE tx_products SET price_paise=199900,version=version+1 WHERE id=$1',[a]);
 await assert.rejects(checkout('66666666-6666-4666-8666-666666666666',accepted),/CART_CHANGED/);
 assert.equal((await query('SELECT stock FROM tx_products WHERE id=$1',[a]))[0].stock,2);
 await query('SELECT tx_set_cart(1,$1,0)',[a]);
});
test('blocking removes reciprocal follows and prevents social and commerce writes',async()=>{
 const [{id:owner}]=await query("INSERT INTO tx_accounts(name,email,password_hash) VALUES('Block Owner','block-owner@example.com','test') RETURNING id");
 const [{id:other}]=await query("INSERT INTO tx_accounts(name,email,password_hash) VALUES('Blocked Person','block-other@example.com','test') RETURNING id");
 const [{id:post}]=await query("INSERT INTO tx_posts(author_id,body) VALUES($1,'A public thought') RETURNING id",[owner]);
 await query('INSERT INTO tx_follows VALUES($1,$2),($2,$1)',[owner,other]);
 await query('SELECT tx_block($1,$2,true)',[owner,other]);
 assert.equal((await query('SELECT tx_visible_post($1,$2) AS visible',[post,other]))[0].visible,false);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_follows WHERE follower_id=$1 OR following_id=$1',[owner]))[0].n,0);
 await assert.rejects(query('INSERT INTO tx_post_likes VALUES($1,$2)',[post,other]),/INTERACTION_UNAVAILABLE/);
 await assert.rejects(query("INSERT INTO tx_comments(post_id,user_id,body) VALUES($1,$2,'Blocked reply')",[post,other]),/INTERACTION_UNAVAILABLE/);
 const listing=await product(3,owner);
 await assert.rejects(query('SELECT tx_set_cart($1,$2,1)',[other,listing]),/PRODUCT_UNAVAILABLE/);
 await query('SELECT tx_block($1,$2,false)',[owner,other]);
 assert.equal((await query('SELECT tx_visible_post($1,$2) AS visible',[post,other]))[0].visible,true);
});
test('moderation requires database admin, hides content, and writes one audit action',async()=>{
 const [{id:admin}]=await query("INSERT INTO tx_accounts(name,email,password_hash,role) VALUES('Moderator','moderator@example.com','test','admin') RETURNING id");
 const [{id:post}]=await query("INSERT INTO tx_posts(author_id,body) VALUES(2,'Reported thought') RETURNING id");
 const [{id:report}]=await query("INSERT INTO tx_reports(reporter_id,kind,target_id,reason) VALUES(1,'post',$1,'Harmful content concern') RETURNING id",[post]);
 await assert.rejects(query("SELECT tx_moderate(1,$1,'hide')",[report]),/ADMIN_REQUIRED/);
 await query("SELECT tx_moderate($1,$2,'hide')",[admin,report]);
 await query("SELECT tx_moderate($1,$2,'hide')",[admin,report]);
 assert.equal((await query('SELECT tx_visible_post($1,1) AS visible',[post]))[0].visible,false);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_moderation_audit WHERE report_id=$1',[report]))[0].n,1);
});
test('suspension increments session version and prevents new content',async()=>{
 const [{id:member}]=await query("INSERT INTO tx_accounts(name,email,password_hash) VALUES('Suspended Member','suspended@example.com','test') RETURNING id");
 const [admin]=await query("SELECT id FROM tx_accounts WHERE role='admin' LIMIT 1");
 const [{id:report}]=await query("INSERT INTO tx_reports(reporter_id,kind,target_id,reason) VALUES(1,'account',$1,'Repeated abuse concern') RETURNING id",[member]);
 await query("SELECT tx_moderate($1,$2,'suspend')",[admin.id,report]);
 const [account]=await query('SELECT status,session_version FROM tx_accounts WHERE id=$1',[member]);
 assert.equal(account.status,'suspended');assert.equal(account.session_version,2);
 await assert.rejects(query("INSERT INTO tx_posts(author_id,body) VALUES($1,'Should not publish')",[member]),/ACCOUNT_NOT_FOUND/);
});
test('password reset tokens expire, are single-use, and revoke prior sessions',async()=>{
 const [{id:who}]=await query("INSERT INTO tx_accounts(name,email,password_hash) VALUES('Reset Member','reset@example.com','old-hash') RETURNING id");
 await query("INSERT INTO tx_password_tokens VALUES('test-token',$1,now()+interval '30 minutes',false),('expired-token',$1,now()-interval '1 minute',false)",[who]);
 await assert.rejects(query("SELECT tx_reset_password('expired-token','new-hash')"),/TOKEN_INVALID/);
 await query("SELECT tx_reset_password('test-token','new-hash')");
 await assert.rejects(query("SELECT tx_reset_password('test-token','another-hash')"),/TOKEN_INVALID/);
 const [account]=await query('SELECT password_hash,session_version FROM tx_accounts WHERE id=$1',[who]);
 assert.equal(account.password_hash,'new-hash');assert.equal(account.session_version,2);
});
test('messages are idempotent, produce notifications, and reject blocked delivery',async()=>{
 const key='77777777-7777-4777-8777-777777777777';
 for(let i=0;i<2;i++)await query("INSERT INTO tx_messages(sender_id,recipient_id,body,client_key) VALUES(1,2,'A private hello',$1) ON CONFLICT(sender_id,client_key) DO NOTHING",[key]);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_messages WHERE client_key=$1',[key]))[0].n,1);
 assert.equal((await query("SELECT count(*)::int AS n FROM tx_notifications WHERE user_id=2 AND kind='message' AND actor_id=1"))[0].n,1);
 await query('SELECT tx_block(2,1,true)');
 await assert.rejects(query("INSERT INTO tx_messages(sender_id,recipient_id,body,client_key) VALUES(1,2,'Should not arrive','88888888-8888-4888-8888-888888888888')"),/INTERACTION_UNAVAILABLE/);
 await query('SELECT tx_block(2,1,false)');
});
test('deletion checks session version and open orders, then erases private and public content',async()=>{
 const [{id:who}]=await query("INSERT INTO tx_accounts(name,email,password_hash) VALUES('Delete Member','delete@example.com','test') RETURNING id");
 const a=await product(1);await query('SELECT tx_set_cart($1,$2,1)',[who,a]);
 const [{id:checkoutId}]=await query('SELECT tx_checkout($1,\'99999999-9999-4999-8999-999999999999\',$2::jsonb,$3::jsonb) AS id',[who,shipping,JSON.stringify([{productId:String(a),quantity:1,unit_paise:99900}])]);
 await assert.rejects(query('SELECT tx_delete_account($1,1)',[who]),/OPEN_ORDERS/);
 const [order]=await query('SELECT id FROM tx_orders WHERE checkout_id=$1',[checkoutId]);await query("SELECT tx_order_status($1,$2,'cancelled')",[who,order.id]);
 await query("INSERT INTO tx_messages(sender_id,recipient_id,body,client_key) VALUES($1,2,'Delete my message','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",[who]);
 await query("INSERT INTO tx_posts(author_id,body) VALUES($1,'Delete my post')",[who]);
 await assert.rejects(query('SELECT tx_delete_account($1,2)',[who]),/ACCOUNT_NOT_FOUND/);
 await query('SELECT tx_delete_account($1,1)',[who]);
 const [account]=await query('SELECT * FROM tx_accounts WHERE id=$1',[who]);assert.equal(account.status,'deleted');assert.equal(account.name,'Deleted member');assert.equal(account.session_version,2);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_messages WHERE sender_id=$1 OR recipient_id=$1',[who]))[0].n,0);
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_posts WHERE author_id=$1',[who]))[0].n,0);
 assert.equal((await query('SELECT shipping FROM tx_orders WHERE id=$1',[order.id]))[0].shipping.address,'Removed');
});
test('administrators can restore mistaken decisions without erasing audit history',async()=>{
 const [admin]=await query("SELECT id FROM tx_accounts WHERE role='admin' LIMIT 1");
 const [report]=await query("SELECT id,target_id FROM tx_reports WHERE kind='account' AND status='resolved' LIMIT 1");
 await assert.rejects(query("SELECT tx_moderate(1,$1,'restore')",[report.id]),/ADMIN_REQUIRED/);
 await query("SELECT tx_moderate($1,$2,'restore')",[admin.id,report.id]);
 assert.equal((await query('SELECT status FROM tx_accounts WHERE id=$1',[report.target_id]))[0].status,'active');
 assert.equal((await query('SELECT count(*)::int AS n FROM tx_moderation_audit WHERE report_id=$1',[report.id]))[0].n,2);
});
test('password changes atomically revoke sessions and existing recovery links',async()=>{
 const [{id:who}]=await query("INSERT INTO tx_accounts(name,email,password_hash) VALUES('Password Member','password-change@example.com','previous-hash') RETURNING id");
 await query("INSERT INTO tx_password_tokens VALUES('old-recovery-link',$1,now()+interval '30 minutes',false)",[who]);
 await query("SELECT tx_change_password($1,1,'previous-hash','next-hash')",[who]);
 assert.equal((await query('SELECT session_version FROM tx_accounts WHERE id=$1',[who]))[0].session_version,2);
 await assert.rejects(query("SELECT tx_reset_password('old-recovery-link','attacker-hash')"),/TOKEN_INVALID/);
 await assert.rejects(query("SELECT tx_change_password($1,1,'previous-hash','another-hash')",[who]),/ACCOUNT_CHANGED/);
});
