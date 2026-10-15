import { readObject } from '@/lib/read-json.mjs';
import { hash } from 'argon2';
import sql from '@/app/api/utils/sql';
import { allowAttempt } from '@/lib/throttle';
import { validateRegistration, sameOrigin } from '@/lib/validation.mjs';
export async function POST(request) {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) return Response.json({ error: 'Account service is not configured.' }, { status: 503 });
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid origin.' }, { status: 403 });
  try {
    if (!await allowAttempt(request, 'register', 5)) return Response.json({ error: 'Please try again later.' }, { status: 429 });
    const { name, email, password } = await readObject(request);
    if (!validateRegistration({ name, email, password })) return Response.json({ error: 'Use a name, valid email, and password of 12–128 characters.' }, { status: 400 });
    const passwordHash = await hash(password);
    await sql`INSERT INTO tx_accounts (name, email, password_hash) VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${passwordHash})`;
    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error.status) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error.code === '23505' ? 'Unable to create this account. Try signing in.' : 'Registration unavailable.' }, { status: error.code === '23505' ? 409 : 500 });
  }
}
