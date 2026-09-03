import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

/** Who the session cookie says you are. Public by design — it answers "nobody"
 *  with a 401 rather than a redirect, so the client can render /login. */
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await verifySession(token);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
