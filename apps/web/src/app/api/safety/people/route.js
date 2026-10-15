import {auth} from '@/auth';
import sql from '@/app/api/utils/sql';
import {fail} from '@/lib/api';
export async function GET(request){if(!process.env.DATABASE_URL)return Response.json({people:[]});try{
 const session=await auth();const id=session?.user?.id||null;const query=(new URL(request.url).searchParams.get('q')||'').slice(0,80);
 const people=await sql`SELECT id,name,bio FROM tx_accounts WHERE status='active' AND id<>coalesce(${id}::bigint,0) AND NOT tx_blocked(id,${id}::bigint) AND name ILIKE ${'%'+query+'%'} ORDER BY id DESC LIMIT 30`;
 return Response.json({people});
}catch(e){return fail(e);}}
