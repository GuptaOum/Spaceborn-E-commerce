import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

/**
 * Tests run against an embedded Postgres by default. Set TEST_DB_HOST (and optionally
 * TEST_DB_PORT/USER/PASSWORD) to use an external server instead, e.g. a Docker container in CI or
 * on machines where the embedded binary cannot run (Windows shells with admin rights).
 * The server must be able to `CREATE EXTENSION vector` (pgvector). The embedded binary cannot, so
 * on a developer machine run the suite against Docker:
 *
 *   docker run -d --name spaceborn-testpg -e POSTGRES_USER=spaceborn -e POSTGRES_PASSWORD=spaceborn -p 54329:5432 pgvector/pgvector:pg16
 *   TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=54329 npm test -w services/api
 *
 * (If the image cannot be pulled, `postgres:16` plus `apt-get install postgresql-16-pgvector` inside it works too.)
 */
export async function startTestDb(dbName: string, embeddedPort: number, uploadsSuffix: string) {
  const external = process.env.TEST_DB_HOST;
  const user = process.env.TEST_DB_USER ?? 'spaceborn';
  const password = process.env.TEST_DB_PASSWORD ?? 'spaceborn';
  const port = external ? Number(process.env.TEST_DB_PORT ?? 5432) : embeddedPort;

  let embedded: EmbeddedPostgres | null = null;
  if (external) {
    const admin = new pg.Client({ host: external, port, user, password, database: 'postgres' });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.query(`create database ${dbName} encoding 'UTF8' template template0`);
    await admin.end();
  } else {
    embedded = new EmbeddedPostgres({
      databaseDir: path.join(os.tmpdir(), `spaceborn-${dbName}-${process.pid}`),
      user,
      password,
      port,
      persistent: false,
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
      onLog: () => {},
      onError: () => {},
    });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase(dbName);
  }

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_HOST: external ?? 'localhost',
    DB_PORT: String(port),
    DB_NAME: dbName,
    DB_USER: user,
    DB_PASSWORD: password,
    DB_SSL: 'disable',
    FIREBASE_PROJECT_ID: 'spaceborn-test',
    AUTH_DEV_BYPASS: 'true',
    RAZORPAY_KEY_ID: '',
    RAZORPAY_KEY_SECRET: '',
    LOG_LEVEL: 'silent',
    UPLOAD_DIR: path.join(os.tmpdir(), `spaceborn-uploads-${uploadsSuffix}-${process.pid}`),
  });

  return {
    stop: async () => {
      if (embedded) await embedded.stop();
    },
  };
}
