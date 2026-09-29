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
  AUTH_DEV_BYPASS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  AWS_REGION: z.string().default('ap-south-1'),
  UPLOADS_BUCKET: z.string().optional().transform(unset),
  UPLOAD_DIR: z.string().default('.uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(50),
});

function load() {
  const env = schema.parse(process.env);
  const isProd = env.NODE_ENV === 'production';
  const razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

  if (isProd && env.AUTH_DEV_BYPASS) throw new Error('AUTH_DEV_BYPASS cannot be enabled in production');
  if (isProd && !razorpayConfigured) throw new Error('Razorpay credentials are required in production');
  if (isProd && env.DB_SSL !== 'require') throw new Error('DB_SSL must be "require" in production');
  if (isProd && !env.UPLOADS_BUCKET) throw new Error('UPLOADS_BUCKET is required in production');

  return {
    ...env,
    isProd,
    paymentsMode: razorpayConfigured ? ('razorpay' as const) : ('mock' as const),
  };
}

export const config = load();
export type Config = typeof config;
