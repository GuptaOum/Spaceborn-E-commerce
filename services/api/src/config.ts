import { z } from 'zod';

const unset = (v: string | undefined) => (!v || v === 'REPLACE_ME' ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
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
  if (isProd && !env.UPLOADS_BUCKET) throw new Error('UPLOADS_BUCKET is required in production');
  if (env.MAIL_PROVIDER === 'ses' && !env.MAIL_FROM) throw new Error('MAIL_FROM is required when MAIL_PROVIDER=ses');

  return {
    ...env,
    isProd,
    paymentsMode: razorpayConfigured ? ('razorpay' as const) : ('mock' as const),
  };
}

export const config = load();
export type Config = typeof config;
