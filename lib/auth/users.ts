// =============================================================================
// Admin accounts, stored in the same Neon Postgres the CRM already reads.
//
// No `server-only` guard here even though this is server code: the CLI that
// provisions accounts (`scripts/admin-user.ts`) imports this file under plain
// node, and `server-only` throws outside a bundler. Nothing client-side imports
// it — the browser only ever sees the shape returned by /api/auth/me.
// =============================================================================

import { neon } from '@neondatabase/serverless';
import type { AdminRole } from './session.ts';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

let _sql: ReturnType<typeof neon> | undefined;
function db() {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.ONEORAL_DB_URL;
    if (!url) throw new Error('[oneoral-admin] DATABASE_URL not set — cannot read admin accounts');
    _sql = neon(url);
  }
  return _sql;
}

let ensured = false;
/** Idempotent; the table is created on first use rather than by a migration
 *  because this app has no migration runner of its own. */
export async function ensureAdminUsersTable(): Promise<void> {
  if (ensured) return;
  await db()`
    CREATE TABLE IF NOT EXISTS admin_users (
      id            text PRIMARY KEY,
      email         text NOT NULL UNIQUE,
      name          text NOT NULL,
      role          text NOT NULL DEFAULT 'ADMIN',
      password_hash text NOT NULL,
      is_active     boolean NOT NULL DEFAULT true,
      last_login_at timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    )
  `;
  ensured = true;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toUser(row: any): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === 'DOCTOR' ? 'DOCTOR' : 'ADMIN',
    passwordHash: row.password_hash,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findAdminUserByEmail(email: string): Promise<AdminUser | null> {
  await ensureAdminUsersTable();
  const rows = (await db()`
    SELECT * FROM admin_users WHERE email = ${normalizeEmail(email)} LIMIT 1
  `) as any[];
  return rows.length ? toUser(rows[0]) : null;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  await ensureAdminUsersTable();
  const rows = (await db()`SELECT * FROM admin_users ORDER BY created_at`) as any[];
  return rows.map(toUser);
}

/** Create the account, or reset an existing one's password/name/role in place. */
export async function upsertAdminUser(input: {
  email: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
}): Promise<AdminUser> {
  await ensureAdminUsersTable();
  const rows = (await db()`
    INSERT INTO admin_users (id, email, name, role, password_hash)
    VALUES (${crypto.randomUUID()}, ${normalizeEmail(input.email)}, ${input.name}, ${input.role}, ${input.passwordHash})
    ON CONFLICT (email) DO UPDATE SET
      name          = EXCLUDED.name,
      role          = EXCLUDED.role,
      password_hash = EXCLUDED.password_hash,
      is_active     = true,
      updated_at    = now()
    RETURNING *
  `) as any[];
  return toUser(rows[0]);
}

export async function setAdminUserActive(email: string, isActive: boolean): Promise<boolean> {
  await ensureAdminUsersTable();
  const rows = (await db()`
    UPDATE admin_users SET is_active = ${isActive}, updated_at = now()
    WHERE email = ${normalizeEmail(email)}
    RETURNING id
  `) as any[];
  return rows.length > 0;
}

export async function recordLogin(id: string): Promise<void> {
  await db()`UPDATE admin_users SET last_login_at = now() WHERE id = ${id}`;
}
