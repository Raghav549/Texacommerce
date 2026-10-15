import { test, expect } from '@playwright/test';
test('desktop saved collection persists and real inbox requires sign-in', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good to have you here' })).toBeVisible();
  await page.getByRole('button', { name: 'Save The Everyday Tote', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name: 'Saved' }).click();
  await expect(page.getByRole('heading', { name: 'The Everyday Tote', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name: 'Messages' }).click();
  await expect(page.getByRole('button', { name: 'Sign in to message', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in to message', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('mobile layout stays within viewport and navigation works', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good to have you here' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-preview.png'), fullPage: true });
  await page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('button', { name: 'Marketplace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Made by people. Found by you.' })).toBeVisible();
  await page.getByRole('tab', { name: 'Your bag (0)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in to continue', exact: true })).toBeVisible();
});
test('all app views render and legacy unsafe APIs fail closed', async ({ page, request }) => {
  for (const view of ['feed', 'explore', 'reels', 'shop', 'messages', 'saved', 'cart', 'profile', 'settings']) {
    await page.goto(`/?view=${view}`);
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  for (const path of ['/api/cart?userId=1', '/api/seed-demo', '/api/messages/decrypt', '/api/auth/custom/login', '/api/checkout']) {
    expect((await request.get(path)).status()).toBe(503);
  }
  expect((await request.post('/api/community/posts', { data: { body: 'No account' } })).status()).toBe(503);
  expect((await request.get('/api/health')).status()).toBe(200);
});
test('account dialog handles unconfigured service and keyboard close', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Your profile', exact: true }).click();
  await page.getByRole('button', { name: 'New around here? Create an account' }).click();
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Test Person');
  await page.getByRole('textbox', { name: 'Email address', exact: true }).fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password-long-enough');
  await page.getByRole('button', { name: 'Create your account', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('not configured');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('desktop screenshot', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 }); await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('desktop-preview.png'), fullPage: true });
});
test('marketplace forms and COD checkout UI with deterministic API fixtures', async ({page})=>{
 const user={id:'1',name:'Test Buyer',email:'buyer@example.com'};
 const product={id:'10',seller_id:'2',seller_name:'Real Maker',name:'Handmade Ceramic',description:'A real handmade ceramic cup.',price_paise:99900,stock:4,category:'Home & living',artwork:2,active:true,version:1};
 let cart=[],orders=[],products=[product],listings=[];
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user}}));
 await page.route('**/api/market/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.split('/').pop(),method=req.method();
  const body=method==='GET'?{}:req.postDataJSON();let data={};
  if(path==='products'&&method==='GET')data={products,mode:'live'};
  if(path==='products'&&method==='POST'){const p={...body,id:'11',seller_id:'1',seller_name:'Test Buyer',version:1};listings=[p];products.push(p);data={product:p};}
  if(path==='cart'&&method==='GET')data={items:cart};
  if(path==='cart'&&method==='PUT'){cart=body.quantity?[{...product,quantity:body.quantity}]:[];data={success:true};}
  if(path==='orders')data={orders};
  if(path==='seller')data={products:listings,orders:[]};
  if(path==='checkout'){expect(body.requestKey).toMatch(/^[a-f0-9-]{36}$/);expect(body.shipping.postal).toBe('823001');orders=[{id:'1',seller_name:'Real Maker',created_at:new Date().toISOString(),status:'placed',total_paise:99900,items:[{name:product.name,quantity:1,unit_paise:99900}]}];cart=[];data={orders,checkoutId:'1'};}
  await route.fulfill({json:data});
 });
 await page.goto('/?view=shop');
 await page.getByRole('button',{name:'Add Handmade Ceramic to bag',exact:true}).click();
 await page.getByRole('tab',{name:'Your bag (1)',exact:true}).click();
 await page.getByLabel('Recipient name',{exact:true}).fill('Test Buyer');
 await page.getByLabel('Delivery address',{exact:true}).fill('123 Example Road, Gaya, Bihar');
 await page.getByLabel('Phone',{exact:true}).fill('9999999999');
 await page.getByLabel('PIN code',{exact:true}).fill('823001');
 await page.getByRole('button',{name:/Place COD order/}).click();
 await expect(page.getByRole('heading',{name:'Order #1',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Seller studio',exact:true}).click();
 await page.getByLabel('Product name',{exact:true}).fill('My new ceramic');
 await page.getByLabel('Description',{exact:true}).fill('Made slowly with love in my home studio.');
 await page.getByLabel('Price (₹)',{exact:true}).fill('899.50');
 await page.getByRole('button',{name:'Publish listing',exact:true}).click();
 await expect(page.getByRole('heading',{name:'My new ceramic',exact:true})).toBeVisible();
});
test('new private APIs fail closed without database configuration',async({request})=>{
 for(const path of ['cart','seller','orders'])expect((await request.get(`/api/market/${path}`)).status()).toBe(503);
 expect((await request.get('/api/market/products')).status()).toBe(200);
 expect((await request.put('/api/community/interactions',{data:{kind:'like',targetId:'1',enabled:true}})).status()).toBe(503);
});
test('live social likes, follows, comments and owner deletion UI with API fixtures',async({page})=>{
 const user={id:'1',name:'Test Reader',email:'reader@example.com'};
 const post={id:'12',author_id:'2',name:'Real Creator',body:'A genuine community thought.',created_at:new Date().toISOString(),likes:0,comments:0,liked:false,following:false};
 let comments=[];
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user}}));
 await page.route('**/api/community/posts',r=>r.fulfill({json:{posts:[post],mode:'live'}}));
 await page.route('**/api/community/interactions',async r=>{const body=r.request().postDataJSON();expect(body.targetId).toBe(body.kind==='like'?'12':'2');await r.fulfill({json:{success:true}});});
 await page.route('**/api/community/comments**',async r=>{
  const method=r.request().method();if(method==='POST')comments=[{id:'5',user_id:'1',name:'Test Reader',body:r.request().postDataJSON().body}];
  if(method==='DELETE')comments=[];
  await r.fulfill({json:method==='GET'?{comments}:method==='POST'?{comment:comments[0]}:{success:true}});
 });
 await page.route('**/api/market/**',r=>r.fulfill({json:{items:[],products:[],orders:[]}}));
 await page.goto('/');
 const live=page.locator('.live-post');await expect(live.getByText('A genuine community thought.',{exact:true})).toBeVisible();
 await live.getByRole('button',{name:'Like community post',exact:true}).click();
 await expect(live.getByRole('button',{name:'Like community post',exact:true})).toHaveAttribute('aria-pressed','true');
 await live.getByRole('button',{name:'Follow',exact:true}).click();await expect(live.getByRole('button',{name:'Following',exact:true})).toBeVisible();
 await live.getByRole('button',{name:'Open community comments',exact:true}).click();
 await live.getByRole('textbox',{name:'Write a comment',exact:true}).fill('A thoughtful reply, saved in the community.');
 await live.getByRole('button',{name:'Reply',exact:true}).click();
 await expect(live.getByText('A thoughtful reply, saved in the community.',{exact:true})).toBeVisible();
 await live.getByRole('button',{name:'Delete your comment',exact:true}).click();
 await expect(live.getByText('A thoughtful reply, saved in the community.',{exact:true})).toHaveCount(0);
});
test('account editing, block management, report queue and moderation UI with fixtures',async({page})=>{
 const user={id:'1',name:'Admin Test',email:'admin@example.com',role:'admin'};let name=user.name,blocks=[{id:'3',name:'Blocked Person'}],reports=[{id:'8',kind:'post',target_id:'10',reason:'This needs a review.',content:'Reported text',reporter_name:'Member'}],audit=[];
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user}}));
 await page.route('**/api/account/profile',async r=>{if(r.request().method()==='PUT')name=r.request().postDataJSON().name;await r.fulfill({json:{profile:{...user,name,bio:'My story',posts:2,followers:3,following:1}}});});
 await page.route('**/api/safety/blocks',async r=>{if(r.request().method()==='PUT')blocks=[];await r.fulfill({json:{blocks,success:true}});});
 await page.route('**/api/safety/moderation',async r=>{if(r.request().method()==='POST'){expect(r.request().postDataJSON().action).toBe('hide');reports=[];audit=[{id:'1',report_id:'8',action:'hide',created_at:new Date().toISOString()}];}await r.fulfill({json:{reports,audit,success:true}});});
 await page.route('**/api/market/**',r=>r.fulfill({json:{products:[],items:[],orders:[]}}));
 await page.goto('/?view=settings');
 await page.getByLabel('Display name',{exact:true}).fill('Updated Admin');await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Updated Admin',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Unblock',exact:true}).click();await expect(page.getByText('You haven’t blocked anyone.',{exact:true})).toBeVisible();
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Hide content',exact:true}).click();
 await expect(page.getByText('No open reports.',{exact:true})).toBeVisible();await expect(page.getByText(/Report #8 · hide/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('private messages and notifications UI with authorized API fixtures',async({page})=>{
 const user={id:'1',name:'Reader',email:'reader@example.com'};let messages=[],notification={id:'4',actor_name:'Creator',body:'You have a new message.',created_at:new Date().toISOString(),read_at:null};
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user}}));
 await page.route('**/api/safety/people**',r=>r.fulfill({json:{people:[{id:'2',name:'Creator',bio:'Making good things.'}]}}));
 await page.route('**/api/market/**',r=>r.fulfill({json:{products:[],items:[],orders:[]}}));
 await page.route('**/api/inbox/messages**',async r=>{
  const req=r.request();let data={};if(req.method()==='POST'){const body=req.postDataJSON();expect(body.recipientId).toBe('2');messages=[{id:'1',sender_id:'1',recipient_id:'2',body:body.body,created_at:new Date().toISOString()}];data={message:messages[0]};}
  else if(req.method()==='PATCH')data={success:true};else if(new URL(req.url()).searchParams.has('peer'))data={messages,person:{id:'2',name:'Creator'}};else data={conversations:[]};await r.fulfill({json:data});
 });
 await page.route('**/api/inbox/notifications',async r=>{if(r.request().method()==='PATCH')notification={...notification,read_at:new Date().toISOString()};await r.fulfill({json:{notifications:[notification],success:true}});});
 await page.goto('/?view=messages');await page.getByLabel('Choose a member',{exact:true}).selectOption('2');
 await page.getByRole('textbox',{name:'Message text',exact:true}).fill('A real text message.');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByText('A real text message.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Notifications',exact:true}).click();await expect(page.getByText('You have a new message.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Mark read',exact:true}).click();await expect(page.getByRole('button',{name:'Mark read',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('recovery links are scrubbed from URL and configured recovery handles unavailable state',async({page})=>{
 await page.goto('/#reset='+ 'a'.repeat(64));await expect(page.getByRole('heading',{name:'Choose a fresh password.',exact:true})).toBeVisible();expect(page.url()).not.toContain('reset=');
 await page.getByLabel('New password',{exact:true}).fill('a-new-long-password');await page.getByRole('button',{name:'Reset password',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('not configured');
});
test('account and safety APIs fail closed without configuration',async({request})=>{
 for(const path of ['account/profile','safety/blocks','safety/moderation','inbox/messages','inbox/notifications'])expect((await request.get('/api/'+path)).status()).toBe(503);
 expect((await request.post('/api/account/delete',{data:{confirmation:'DELETE',password:'not-a-real-password'}})).status()).toBe(503);
 expect((await request.post('/api/account/recovery',{data:{action:'request',email:'someone@example.com'}})).status()).toBe(503);
});
