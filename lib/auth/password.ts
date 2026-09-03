// =============================================================================
// Password hashing for admin sign-in.
//
// PBKDF2-HMAC-SHA256 over Web Crypto rather than bcrypt or argon2: the same
// code has to run inside a route handler, inside the CLI that provisions
// accounts, and potentially inside the proxy, and Web Crypto is the only hash
// primitive present in all three without a native build step. Nothing in this
// file may import `server-only` or a Next path alias — `scripts/admin-user.ts`
// loads it directly under plain node.
// =============================================================================

const ALGO = 'pbkdf2';
const DIGEST = 'sha256';
const ITERATIONS = 210_000; // OWASP's floor for PBKDF2-HMAC-SHA256
const KEY_BYTES = 32;
const SALT_BYTES = 16;

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** `pbkdf2$sha256$<iterations>$<salt>$<hash>` — self-describing, so raising the
 *  iteration count later doesn't invalidate hashes already in the table. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return [ALGO, DIGEST, ITERATIONS, toBase64Url(salt), toBase64Url(hash)].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5) return false;
  const [algo, digest, rawIterations, rawSalt, rawHash] = parts;
  if (algo !== ALGO || digest !== DIGEST) return false;

  const iterations = Number(rawIterations);
  if (!Number.isInteger(iterations) || iterations < 1000) return false;

  try {
    const expected = fromBase64Url(rawHash);
    const actual = await derive(password, fromBase64Url(rawSalt), iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false; // malformed salt/hash in the row — treat as a failed login
  }
}

/**
 * A syntactically valid hash that no password matches. Verifying against this
 * when the email isn't in the table burns the same CPU as a real check, so a
 * stopwatch can't tell "no such account" from "wrong password".
 */
export const UNMATCHABLE_HASH = [ALGO, DIGEST, ITERATIONS, 'A'.repeat(22), 'B'.repeat(43)].join('$');

/** Human-friendly, unambiguous (no O/0/I/l), ~93 bits for a first-issue password. */
export function generatePassword(length = 18): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
