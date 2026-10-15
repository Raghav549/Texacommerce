import { createHash } from 'node:crypto';
import sql from '@/app/api/utils/sql';
// Atomic database buckets work across Vercel instances (unlike an in-memory Map).
export async function allowAttempt(request, action, limit = 10) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const bucket = Math.floor(Date.now() / 900000);
  const key = createHash('sha256').update(`${action}:${ip}:${bucket}:${process.env.AUTH_SECRET}`).digest('hex');
  const [row] = await sql`INSERT INTO tx_rate_limits (key, attempts, expires_at) VALUES (${key}, 1, now() + interval '30 minutes') ON CONFLICT (key) DO UPDATE SET attempts = tx_rate_limits.attempts + 1 RETURNING attempts`;
  // Opportunistic cleanup; no per-instance timers and no retained raw IP addresses.
  if (Math.random() < 0.02) await sql`DELETE FROM tx_rate_limits WHERE expires_at < now()`;
  return row.attempts <= limit;
}
