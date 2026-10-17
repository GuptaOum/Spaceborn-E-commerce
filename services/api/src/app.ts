import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { errorHandler, forbidden, notFound } from './errors.js';
import { adminRouter } from './routes/admin.js';
import { aiRouter } from './routes/ai.js';
import { catalogRouter } from './routes/catalog.js';
import { fabricationRouter } from './routes/fabrication.js';
import { geoRouter } from './routes/geo.js';
import { meRouter } from './routes/me.js';
import { ordersRouter } from './routes/orders.js';
import { paymentsRouter } from './routes/payments.js';
import { vendorRouter } from './routes/vendor.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(helmet());

  if (config.CORS_ORIGIN) {
    const origins = config.CORS_ORIGIN.split(',').map((s) => s.trim());
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && (origins.includes('*') || origins.includes(origin))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Idempotency-Key,X-File-Name');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else if (origins.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Idempotency-Key,X-File-Name');
      }
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });
  }

  const healthHandler = async (_req: Request, res: Response) => {
    await pool.query('select 1');
    res.json({ ok: true });
  };
  app.get('/health', healthHandler);
  app.get('/v1/health', healthHandler);

  const ADMIN_PREFIX = /^\/v1\/admin(\/|$)/;

  // Load balancer path rules are case-sensitive but Express routing is not, so `/v1/ADMIN/...`
  // would slip past the listener rule that keeps the admin API off the public endpoint. Only the
  // canonical lowercase prefix is ever served; a case variant is nothing but a bypass attempt.
  app.use((req, _res, next) => {
    const path = req.path;
    next(ADMIN_PREFIX.test(path.toLowerCase()) && !ADMIN_PREFIX.test(path) ? forbidden() : undefined);
  });

  const v1 = express.Router();
  // Mounted before the JSON parser: the webhook needs the raw body for signature checks.
  v1.use(paymentsRouter);
  v1.use(express.json({ limit: '100kb' }));
  v1.use('/me', meRouter);
  v1.use('/orders', ordersRouter);
  v1.use('/vendor', vendorRouter);
  v1.use('/admin', adminRouter);
  v1.use(fabricationRouter);
  v1.use(catalogRouter);
  v1.use(geoRouter);
  v1.use(aiRouter);

  app.use('/v1', v1);
  app.use(() => {
    throw notFound('Route not found');
  });
  app.use(errorHandler);
  return app;
}
