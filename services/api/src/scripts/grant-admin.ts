import { firebaseAuth, setRoleClaims } from '../auth.js';
import { pool } from '../db/pool.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run grant-admin -- <email>');
  process.exit(1);
}

// 1. Check if user already exists in PostgreSQL
const { rows } = await pool.query<{ id: string }>(
  `select id from users where lower(email) = $1`,
  [email],
);

if (rows.length > 0 && rows[0]) {
  const uid = rows[0].id;
  await pool.query(`update users set role = 'admin' where id = $1`, [uid]);
  try {
    await setRoleClaims(uid, 'admin', null);
  } catch {}
  console.log(`Granted admin role to ${email} (uid: ${uid}) in database.`);
} else {
  // Pre-authorize the email in PostgreSQL so when they sign in, they become admin immediately
  const preauthId = `preauth-${Date.now()}`;
  await pool.query(
    `insert into users (id, email, full_name, role)
     values ($1, $2, 'Admin Preauth', 'admin')
     on conflict (id) do update set role = 'admin'`,
    [preauthId, email],
  );
  try {
    const user = await firebaseAuth.getUserByEmail(email);
    if (user?.uid) {
      await pool.query(`update users set id = $1 where id = $2`, [user.uid, preauthId]);
      await setRoleClaims(user.uid, 'admin', null);
    }
  } catch {}
  console.log(`Pre-authorized ${email} as administrator in database.`);
}

console.log(`${email} is now an admin. Sign in or refresh to take effect.`);
await pool.end();
