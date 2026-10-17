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
  // Proxies in front of the API that append to X-Forwarded-For: 1 for the load balancer alone, 2 with
  // CloudFront in front of it. Too low and every customer shares the proxy's IP for rate limits.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
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
  // Internal URL of the FastAPI copilot service and the shared secret both sides check. Unset: the
  // chat endpoint answers with plain nearby search results and no language model.
  COPILOT_URL: z.preprocess((v) => unset(v as string | undefined), z.string().url().optional()),
  COPILOT_TOKEN: z.preprocess((v) => unset(v as string | undefined), z.string().min(24).optional()),
  // How long to wait for the copilot to start answering before falling back to search.
  COPILOT_HEADERS_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(10_000),
  // DynamoDB table for copilot conversations. Unset: Redis, or process memory without Redis.
  AI_MEMORY_TABLE: z.string().optional().transform(unset),
  AI_CHAT_PER_10_MIN: z.coerce.number().int().min(1).max(1000).default(20),
  AI_CHAT_PER_DAY: z.coerce.number().int().min(1).max(10_000).default(150),
  // Comma-separated brokers inside the VPC. Unset: nothing is streamed and the outbox relay stays idle.
  KAFKA_BROKERS: z.string().optional().transform(unset),
  KAFKA_TOPIC_PREFIX: z.string().regex(/^[a-z0-9._-]+$/).default('spaceborn'),
  // Hands fabrication uploads to the Python CAD worker (Celery) over REDIS_URL.
  CAD_ANALYSIS_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  CELERY_CAD_QUEUE: z.string().regex(/^[\w.-]+$/).default('cad'),
  MAIL_PROVIDER: z.enum(['log', 'ses']).default('log'),
  MAIL_FROM: z.string().optional().transform(unset),
  MAIL_CONFIGURATION_SET: z.string().optional().transform(unset),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:3000'),
  VENDOR_ORIGIN: z.string().url().default('http://localhost:3001'),
  CORS_ORIGIN: z.string().optional().transform(unset),
  // Empty locally and on the Render demo: the API serves the catalog straight from Postgres.
  REDIS_URL: z.string().optional().transform(unset),
  // A paid order the shop has not accepted after this long is cancelled, refunded, and the shop goes offline.
  ORDER_ACCEPT_MINUTES: z.coerce.number().int().min(3).max(240).default(15),
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
  if (env.CAD_ANALYSIS_ENABLED && !env.REDIS_URL) throw new Error('CAD_ANALYSIS_ENABLED needs REDIS_URL (the Celery broker)');
  if (env.COPILOT_URL && !env.COPILOT_TOKEN) throw new Error('COPILOT_URL needs COPILOT_TOKEN');

  return {
    ...env,
    isProd,
    paymentsMode: razorpayConfigured ? ('razorpay' as const) : ('mock' as const),
  };
}

export const config = load();
export type Config = typeof config;
