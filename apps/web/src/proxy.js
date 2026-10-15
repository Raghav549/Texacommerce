import { NextResponse } from 'next/server';

// The imported legacy handlers have not passed an ownership/payment audit.
// Fail closed instead of exposing IDOR and public seed/reset endpoints.
export function proxy(request) {
  const path = request.nextUrl.pathname;
  if (path === '/api/health' || path.startsWith('/api/account/') || path.startsWith('/api/safety/') || path.startsWith('/api/inbox/') || path.startsWith('/api/community/') || path.startsWith('/api/market/') || /^\/api\/auth\/(csrf|session|providers|callback\/credentials|signin|signout|error)(\/|$)/.test(path)) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: 'This legacy service is unavailable pending its security and database migration.', code: 'SERVICE_NOT_READY' }, { status: 503 });
}
export const config = { matcher: '/api/:path*' };
