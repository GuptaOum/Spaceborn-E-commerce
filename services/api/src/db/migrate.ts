import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { logger } from '../logger.js';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
const LOCK_ID = 727_001;

export async function migrate() {
  const client = await pool.connect();
  try {
    const encoding = await client.query<{ server_encoding: string }>('show server_encoding');
    if (encoding.rows[0]?.server_encoding !== 'UTF8') {
      throw new Error(`Database must use UTF8 encoding (found ${encoding.rows[0]?.server_encoding}); recreate it with ENCODING 'UTF8'`);
    }
    await client.query('select pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(
      'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const { rows } = await client.query<{ name: string }>('select name from schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      logger.info({ file }, 'applying migration');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
    logger.info('migrations up to date');
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      logger.error({ err }, 'migration failed');
      process.exit(1);
    });
}
