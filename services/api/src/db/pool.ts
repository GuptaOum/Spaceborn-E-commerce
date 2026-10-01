import fs from 'node:fs';
import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../logger.js';

pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

function sslOptions(): pg.PoolConfig['ssl'] {
  if (config.DB_SSL === 'disable') return false;
  const ca = config.DB_SSL_CA_PATH ? fs.readFileSync(config.DB_SSL_CA_PATH, 'utf8') : undefined;
  return { rejectUnauthorized: Boolean(ca), ca };
}

export const pool = new pg.Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  ssl: sslOptions(),
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
});

pool.on('error', (err) => logger.error({ err }, 'idle postgres client error'));

export type Db = pg.Pool | pg.PoolClient;

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
