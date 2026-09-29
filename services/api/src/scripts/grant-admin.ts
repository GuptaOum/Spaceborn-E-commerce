import { firebaseAuth, setRoleClaims } from '../auth.js';
import { pool } from '../db/pool.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run grant-admin -- <email>');
  process.exit(1);
}

const user = await firebaseAuth.getUserByEmail(email);
await pool.query(
  `insert into users (id, email, full_name) values ($1, $2, $3) on conflict (id) do nothing`,
  [user.uid, user.email ?? null, user.displayName ?? null],
);
await setRoleClaims(user.uid, 'admin', null);
console.log(`${email} is now an admin. They must sign out and back in for it to take effect.`);
await pool.end();
