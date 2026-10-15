import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
import {validId,validKey} from '@/lib/market-validation.mjs';
import {allowAttempt} from '@/lib/throttle';
export async function GET(request){try{
 const user=await identity(request);const peer=new URL(request.url).searchParams.get('peer');
 if(peer){
  if(!validId(peer))return invalid();
  const [person]=await sql`SELECT id,name FROM tx_accounts WHERE id=${peer} AND status='active' AND NOT tx_blocked(id,${user.id}::bigint)`;
  if(!person)return Response.json({error:'Conversation unavailable.'},{status:404});
  const messages=await sql`SELECT id,sender_id,recipient_id,body,created_at,read_at FROM tx_messages WHERE (sender_id=${user.id} AND recipient_id=${peer}) OR (sender_id=${peer} AND recipient_id=${user.id}) ORDER BY id DESC LIMIT 100`;
  return Response.json({messages:messages.reverse(),person});
 }
 const conversations=await sql`SELECT a.id,a.name,m.body,m.created_at,(SELECT count(*)::int FROM tx_messages u WHERE u.sender_id=a.id AND u.recipient_id=${user.id} AND u.read_at IS NULL) AS unread FROM tx_accounts a JOIN LATERAL (SELECT body,created_at FROM tx_messages WHERE (sender_id=a.id AND recipient_id=${user.id}) OR (recipient_id=a.id AND sender_id=${user.id}) ORDER BY id DESC LIMIT 1) m ON true WHERE a.id<>${user.id} AND a.status='active' AND NOT tx_blocked(a.id,${user.id}::bigint) ORDER BY m.created_at DESC LIMIT 50`;
 return Response.json({conversations});
}catch(e){return fail(e);}}
export async function POST(request){try{
 const user=await identity(request,true);const {recipientId,body,clientKey}=await readObject(request);
 if(!validId(recipientId)||recipientId===String(user.id)||typeof body!=='string'||!body.trim()||body.length>2000||!validKey(clientKey))return invalid('Choose a recipient and write 1–2,000 characters.');
 if(!await allowAttempt(request,`message:${user.id}`,60))return Response.json({error:'Please slow down.'},{status:429});
 // A reused key never overwrites or redelivers the original message.
 const [message]=await sql`INSERT INTO tx_messages(sender_id,recipient_id,body,client_key) VALUES(${user.id},${recipientId},${body.trim()},${clientKey}) ON CONFLICT(sender_id,client_key) DO NOTHING RETURNING id,sender_id,recipient_id,body,created_at`;
 if(message)return Response.json({message},{status:201});
 const [existing]=await sql`SELECT id,sender_id,recipient_id,body,created_at FROM tx_messages WHERE sender_id=${user.id} AND client_key=${clientKey}`;
 if(String(existing?.recipient_id)!==recipientId||existing?.body!==body.trim())return Response.json({error:'This send key was already used for a different message.'},{status:409});
 return Response.json({message:existing});
}catch(e){return fail(e);}}
export async function PATCH(request){try{
 const user=await identity(request,true);const {peer}=await readObject(request);if(!validId(peer))return invalid();
 await sql`UPDATE tx_messages SET read_at=now() WHERE recipient_id=${user.id} AND sender_id=${peer} AND read_at IS NULL`;
 return Response.json({success:true});
}catch(e){return fail(e);}}
