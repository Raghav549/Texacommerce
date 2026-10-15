import { auth } from '@/auth';
import { sameOrigin } from '@/lib/validation.mjs';
export async function identity(request, mutation=false) {
 if(mutation && !sameOrigin(request)) throw Object.assign(new Error('Invalid request origin.'),{ status:403 });
 if(!process.env.DATABASE_URL || !process.env.AUTH_SECRET) throw Object.assign(new Error('Service is not configured.'),{ status:503 });
 const session=await auth();
 if(!session?.user?.id) throw Object.assign(new Error('Sign in to continue.'),{ status:401 });
 return session.user;
}
export function fail(error) {
 const messages={ ACCOUNT_CHANGED:'Your account changed. Sign in again before retrying.', INTERACTION_UNAVAILABLE:'This interaction is unavailable.', ACCOUNT_NOT_FOUND:'Account not found.', ADMIN_REQUIRED:'Administrator access is required.', REPORT_NOT_FOUND:'Report not found.', INVALID_MODERATION_ACTION:'That moderation action is not allowed.', TOKEN_INVALID:'This reset link is invalid or expired.', OPEN_ORDERS:'Complete or cancel all open purchases and sales before deleting your account.', ADMIN_DELETE_REQUIRES_TRANSFER:'An administrator must transfer access before account deletion.', CART_CHANGED:'Your bag or prices changed. Review the latest quantities and prices before placing a new order.', EMPTY_CART:'Your bag is empty.', INSUFFICIENT_STOCK:'Stock has changed. Review your bag before ordering.', PRODUCT_UNAVAILABLE:'A product is no longer available.', OWN_PRODUCT:'You cannot buy your own listing.', INVALID_QUANTITY:'Choose a quantity from 0 to 20.', CART_TOO_LARGE:'Your bag can contain at most 50 listings.', INVALID_SHIPPING:'Enter a complete Indian delivery address.', ORDER_NOT_FOUND:'Order not found.', INVALID_TRANSITION:'That order status change is not allowed.' };
 const code=Object.keys(messages).find(code=>error.message?.includes(code));
 if(code) return Response.json({ error:messages[code],code },{ status:code==='ADMIN_REQUIRED'?403:['ORDER_NOT_FOUND','ACCOUNT_NOT_FOUND','REPORT_NOT_FOUND'].includes(code)?404:409 });
 if(error instanceof SyntaxError) return Response.json({error:'Invalid JSON body.'},{status:400});
 if(error.status) return Response.json({ error:error.message },{status:error.status});
 console.error('API failure',error.code || error.name || 'unknown');
 return Response.json({error:'Service unavailable. Please try again.'},{status:503});
}
export function invalid(message='Invalid request.') { return Response.json({error:message},{status:400}); }
