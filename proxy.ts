import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

// Server-side gate for the whole admin (pages AND /api/*): these routes serve
// real member PII and revenue, so production must not be publicly readable.
//
// Access is a signed session cookie issued by /api/auth/login against the
// `admin_users` table — one account per person, so sign-in is revocable and
// last_login_at says who was in.
//
// HTTP Basic (ADMIN_USER / ADMIN_PASSWORD) survives as break-glass for
// scripted access and for getting back in if the session secret or the
// database is unreachable. It is deliberately never *challenged* — returning
// WWW-Authenticate would pop the browser's native dialog in front of the login
// page — so it only applies when a client sends the header unprompted.
//
// With neither configured (local dev: no ADMIN_SESSION_SECRET, no ADMIN_USER)
// the gate is off, as before.

const PUBLIC_PREFIXES = ['/login', '/api/auth/'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function hasValidBasic(req: NextRequest): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return false;

  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');
    return decoded.slice(0, separator) === user && decoded.slice(separator + 1) === pass;
  } catch {
    return false; // malformed header
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const gateConfigured = Boolean(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_USER);
  if (!gateConfigured) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session || hasValidBasic(req)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg).*)'],
};
