import {neon} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL||!process.env.ADMIN_EMAIL)throw new Error('Set DATABASE_URL and ADMIN_EMAIL in your trusted shell.');
if(process.env.CONFIRM_ADMIN_PROMOTION!=='yes')throw new Error('Set CONFIRM_ADMIN_PROMOTION=yes only after verifying that you own the account.');
const sql=neon(process.env.DATABASE_URL);
const accounts=await sql`UPDATE tx_accounts SET role='admin',session_version=session_version+1 WHERE email=${process.env.ADMIN_EMAIL.trim().toLowerCase()} AND status='active' RETURNING id`;
if(accounts.length!==1)throw new Error('Exactly one active registered account must match. No account was promoted.');
console.log('Administrator assigned. Existing sessions were revoked; sign in again.');
