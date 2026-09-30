import express from 'express';
import helmet from 'helmet';
import { pool } from './db/pool.js';
import { errorHandler, forbidden, notFound } from './errors.js';
import { adminRouter } from './routes/admin.js';
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
  app.set('trust proxy', 1);
  app.use(helmet());

  app.get('/health', async (_req, res) => {
    await pool.query('select 1');
    res.json({ ok: true });
  });

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

  app.use('/v1', v1);
  app.use(() => {
    throw notFound('Route not found');
  });
  app.use(errorHandler);
  return app;
}
