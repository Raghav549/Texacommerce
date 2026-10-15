export function validateRegistration({ name, email, password } = {}) {
  return typeof name === 'string' && name.trim().length >= 2 && name.length <= 80 && typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && typeof password === 'string' && password.length >= 12 && password.length <= 128;
}
export function validPost(body) {
  return typeof body === 'string' && Boolean(body.trim()) && body.length <= 2000;
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Non-browser clients still require authentication on private routes.
  try {
    // AUTH_URL is operator-controlled. Never trust arbitrary forwarded-host/origin headers.
    // Next's internal request URL can differ from the public origin behind a proxy.
    const expected = new URL(process.env.AUTH_URL || request.url).origin;
    return expected !== 'null' && origin === expected;
  } catch { return false; }
}
