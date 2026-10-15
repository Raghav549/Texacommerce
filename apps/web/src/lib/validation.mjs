export function validateRegistration({ name, email, password } = {}) {
  return typeof name === 'string' && name.trim().length >= 2 && name.length <= 80 && typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && typeof password === 'string' && password.length >= 12 && password.length <= 128;
}
export function validPost(body) {
  return typeof body === 'string' && Boolean(body.trim()) && body.length <= 2000;
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
