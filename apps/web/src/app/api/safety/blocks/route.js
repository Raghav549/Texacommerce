import sql from '@/app/api/utils/sql';
import {identity,fail,invalid} from '@/lib/api';
import {readObject} from '@/lib/read-json.mjs';
import {validId} from '@/lib/market-validation.mjs';
export async function GET(request){try{const user=await identity(request);const blocks=await sql`SELECT a.id,a.name FROM tx_blocks b JOIN tx_accounts a ON a.id=b.blocked_id WHERE b.blocker_id=${user.id} ORDER BY b.created_at DESC LIMIT 200`;return Response.json({blocks});}catch(e){return fail(e);}}
export async function PUT(request){try{const user=await identity(request,true);const {id,enabled}=await readObject(request);if(!validId(id)||typeof enabled!=='boolean')return invalid();await sql`SELECT tx_block(${user.id}::bigint,${id}::bigint,${enabled})`;return Response.json({success:true});}catch(e){return fail(e);}}
