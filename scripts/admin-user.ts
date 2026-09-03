// =============================================================================
// Provision admin.oneoral.com sign-ins.
//
//   node --env-file=.env.local scripts/admin-user.ts list
//   node --env-file=.env.local scripts/admin-user.ts create you@oneoral.com "Your Name" [ADMIN|DOCTOR] [password]
//   node --env-file=.env.local scripts/admin-user.ts reset  you@oneoral.com [password]
//   node --env-file=.env.local scripts/admin-user.ts disable you@oneoral.com
//   node --env-file=.env.local scripts/admin-user.ts enable  you@oneoral.com
//
// Needs DATABASE_URL (the same Neon the CRM reads). Omit the password and one
// is generated and printed — it is the only time it is ever readable, since
// only the PBKDF2 hash is stored.
//
// Runs on node's native type stripping (node >= 22.6), which is why the imports
// below carry explicit .ts extensions.
// =============================================================================

import { generatePassword, hashPassword } from '../lib/auth/password.ts';
import {
  listAdminUsers,
  normalizeEmail,
  setAdminUserActive,
  upsertAdminUser,
  findAdminUserByEmail,
} from '../lib/auth/users.ts';

const [command, ...args] = process.argv.slice(2);

function bail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function main() {
  switch (command) {
    case 'list': {
      const users = await listAdminUsers();
      if (!users.length) {
        console.log('\n  No admin accounts yet.\n');
        return;
      }
      console.log('');
      for (const user of users) {
        const state = user.isActive ? 'active  ' : 'disabled';
        const seen = user.lastLoginAt ? `last login ${user.lastLoginAt.slice(0, 16).replace('T', ' ')}` : 'never signed in';
        console.log(`  ${state}  ${user.email.padEnd(28)} ${user.role.padEnd(7)} ${user.name.padEnd(20)} ${seen}`);
      }
      console.log('');
      return;
    }

    case 'create':
    case 'reset': {
      const [email, ...rest] = args;
      if (!email) bail(`Usage: ${command} <email> ${command === 'create' ? '"<name>" [ADMIN|DOCTOR] ' : ''}[password]`);

      const existing = await findAdminUserByEmail(email);
      if (command === 'reset' && !existing) bail(`No account for ${normalizeEmail(email)} — use "create".`);

      let name: string;
      let role: 'ADMIN' | 'DOCTOR';
      let password: string | undefined;

      if (command === 'create') {
        name = rest[0] || existing?.name || normalizeEmail(email).split('@')[0];
        const maybeRole = (rest[1] || '').toUpperCase();
        role = maybeRole === 'DOCTOR' ? 'DOCTOR' : maybeRole === 'ADMIN' || !maybeRole ? 'ADMIN' : bail(`Role must be ADMIN or DOCTOR, got "${rest[1]}"`);
        password = rest[2];
      } else {
        name = existing!.name;
        role = existing!.role;
        password = rest[0];
      }

      const generated = !password;
      const plaintext = password || generatePassword();
      const user = await upsertAdminUser({ email, name, role, passwordHash: await hashPassword(plaintext) });

      console.log(`\n  ${existing ? 'Updated' : 'Created'}  ${user.email}  (${user.name}, ${user.role})`);
      console.log('  URL       https://admin.oneoral.com');
      console.log(`  Password  ${plaintext}${generated ? '   <- generated, shown once' : ''}\n`);
      return;
    }

    case 'disable':
    case 'enable': {
      const [email] = args;
      if (!email) bail(`Usage: ${command} <email>`);
      const found = await setAdminUserActive(email, command === 'enable');
      if (!found) bail(`No account for ${normalizeEmail(email)}.`);
      console.log(`\n  ${normalizeEmail(email)} is now ${command === 'enable' ? 'active' : 'disabled'}.\n`);
      return;
    }

    default:
      bail('Commands: list | create | reset | disable | enable');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
