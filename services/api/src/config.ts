import { z } from 'zod';

const unset = (v: string | undefined) => (!v || v === 'REPLACE_ME' ? undefined : v);

// Parse DATABASE_URL if present and individual DB_* vars not set
if (process.env.DATABASE_URL) {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    if (!process.env.DB_HOST && parsed.hostname) process.env.DB_HOST = parsed.hostname;
    if (!process.env.DB_PORT && parsed.port) process.env.DB_PORT = parsed.port;
    if (!process.env.DB_NAME && parsed.pathname) process.env.DB_NAME = parsed.pathname.replace(/^\//, '');
    if (!process.env.DB_USER && parsed.username) process.env.DB_USER = decodeURIComponent(parsed.username);
    if (!process.env.DB_PASSWORD && parsed.password) process.env.DB_PASSWORD = decodeURIComponent(parsed.password);
    if (!process.env.DB_SSL && (parsed.searchParams.get('sslmode') === 'require' || parsed.searchParams.get('ssl') === 'true')) {
      process.env.DB_SSL = 'require';
    }
  } catch {
    // If not a valid URL, individual vars or zod will handle it
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().optional().transform(unset),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.enum(['disable', 'require']).default('disable'),
  DB_SSL_CA_PATH: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().default(10),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional().transform(unset),
  RAZORPAY_KEY_ID: z.string().optional().transform(unset),
  RAZORPAY_KEY_SECRET: z.string().optional().transform(unset),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().transform(unset),
  // Explicit opt-in for a non-prod cloud stack to run without Razorpay keys. Ignored once keys are set.
  PAYMENTS_ALLOW_MOCK: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  AUTH_DEV_BYPASS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  AWS_REGION: z.string().default('ap-south-1'),
  UPLOADS_BUCKET: z.string().optional().transform(unset),
  UPLOAD_DIR: z.string().default('.uploads'),
  UPLOADS_ALLOW_LOCAL: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(50),
  PRODUCT_IMAGE_MAX_MB: z.coerce.number().int().min(1).max(15).default(8),
  // Empty in local dev: a deterministic local embedder is used. Set these in AWS to use Bedrock.
  BEDROCK_TEXT_MODEL: z.string().optional().transform(unset),
  BEDROCK_IMAGE_MODEL: z.string().optional().transform(unset),
  MAIL_PROVIDER: z.enum(['log', 'ses']).default('log'),
  MAIL_FROM: z.string().optional().transform(unset),
  MAIL_CONFIGURATION_SET: z.string().optional().transform(unset),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3000'),
  VENDOR_ORIGIN: z.string().url().default('http://localhost:3001'),
  CORS_ORIGIN: z.string().optional().transform(unset),
  // Empty locally and on the Render demo: the API serves the catalog straight from Postgres.
  REDIS_URL: z.string().optional().transform(unset),
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
});

function load() {
  const env = schema.parse(process.env);
  const isProd = env.NODE_ENV === 'production';
  const razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

  if (isProd && env.AUTH_DEV_BYPASS) throw new Error('AUTH_DEV_BYPASS cannot be enabled in production');
  if (isProd && !razorpayConfigured && !env.PAYMENTS_ALLOW_MOCK) {
    throw new Error('Razorpay credentials are required in production (or set PAYMENTS_ALLOW_MOCK=true on a non-prod stack)');
  }
  if (isProd && env.DB_SSL !== 'require') throw new Error('DB_SSL must be "require" in production');
  if (isProd && !env.UPLOADS_BUCKET && !env.UPLOADS_ALLOW_LOCAL) {
    throw new Error('UPLOADS_BUCKET is required in production (or set UPLOADS_ALLOW_LOCAL=true for self-hosted disk storage)');
  }
  if (env.MAIL_PROVIDER === 'ses' && !env.MAIL_FROM) throw new Error('MAIL_FROM is required when MAIL_PROVIDER=ses');

  return {
    ...env,
    isProd,
    paymentsMode: razorpayConfigured ? ('razorpay' as const) : ('mock' as const),
  };
}

export const config = load();
export type Config = typeof config;
