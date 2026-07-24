import { NextRequest, NextResponse } from 'next/server';

// Server-side gate for the whole admin (pages AND /api/*): the in-app login is
// a client-side mock, and the API routes serve real member PII + revenue, so
// production must not be publicly readable. HTTP Basic auth, credentials from
// env — when ADMIN_USER / ADMIN_PASSWORD are unset (local dev), the gate is off.
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const [u, p] = atob(header.slice(6)).split(':');
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      /* malformed header → fall through to 401 */
    }
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="OneOral Admin"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg).*)'],
};
