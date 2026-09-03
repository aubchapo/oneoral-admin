// =============================================================================
// Admin session cookie: an HMAC-SHA256-signed payload, verified statelessly.
//
// Stateless on purpose. The proxy gates every page and every /api/* route, so
// a DB-backed session would put a Postgres round trip in front of every asset
// request. The trade is that revocation isn't instant — deactivating an account
// stops new logins immediately, but an already-issued cookie stays good until
// it expires, which is why the TTL is short.
//
// No `server-only` / path aliases here: `scripts/admin-user.ts` loads this file
// directly under plain node.
// =============================================================================

import { fromBase64Url, toBase64Url } from './password.ts';

export const SESSION_COOKIE = 'oneoral_admin_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // one working day

export type AdminRole = 'ADMIN' | 'DOCTOR';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

interface SessionPayload extends SessionUser {
  iat: number;
  exp: number;
}

function sessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

/** True when the deployment is configured to issue sessions at all. */
export function sessionsEnabled(): boolean {
  return sessionSecret() !== null;
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

export async function signSession(
  user: SessionUser,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error('[oneoral-admin] ADMIN_SESSION_SECRET is unset or shorter than 32 chars');

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { ...user, iat: now, exp: now + ttlSeconds };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${toBase64Url(await hmac(secret, body))}`;
}

export async function verifySession(token: string | null | undefined): Promise<SessionUser | null> {
  const secret = sessionSecret();
  if (!secret || !token) return null;

  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  try {
    if (!timingSafeEqual(fromBase64Url(signature), await hmac(secret, body))) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!payload.id || !payload.email) return null;

    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
  } catch {
    return null; // tampered, truncated, or not one of ours
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
