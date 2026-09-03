import { NextResponse } from 'next/server';
import { UNMATCHABLE_HASH, verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, sessionsEnabled, signSession } from '@/lib/auth/session';
import { findAdminUserByEmail, recordLogin } from '@/lib/auth/users';

/**
 * Per-instance attempt throttle. Fluid Compute reuses instances, so this
 * catches a script hammering one email; it is a speed bump, not a guarantee,
 * and deliberately keyed on IP so one locked-out attacker can't lock out a
 * colleague by guessing at their address.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const failures = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || 'unknown';
}

function isThrottled(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = failures.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function POST(request: Request) {
  if (!sessionsEnabled()) {
    console.error('[oneoral-admin] login attempted with ADMIN_SESSION_SECRET unset');
    return NextResponse.json({ error: 'Sign-in is not configured on this deployment.' }, { status: 503 });
  }

  const key = clientKey(request);
  if (isThrottled(key)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const user = await findAdminUserByEmail(email);

  // Verify even when there is no such account, against a hash nothing matches,
  // so the response time doesn't tell an attacker which emails are real.
  const ok = await verifyPassword(password, user?.passwordHash ?? UNMATCHABLE_HASH);

  if (!user || !ok || !user.isActive) {
    recordFailure(key);
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  failures.delete(key);
  const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = await signSession(sessionUser);

  // Best-effort: a failed audit stamp must not cost someone their login.
  await recordLogin(user.id).catch((err) => console.error('[oneoral-admin] recordLogin failed', err));

  const response = NextResponse.json({ user: sessionUser });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
