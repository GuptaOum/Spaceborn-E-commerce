import express from 'express';
import helmet from 'helmet';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './errors.js';
import { adminRouter } from './routes/admin.js';
import { catalogRouter } from './routes/catalog.js';
import { fabricationRouter } from './routes/fabrication.js';
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

  app.use('/v1', v1);
  app.use(() => {
    throw notFound('Route not found');
  });
  app.use(errorHandler);
  return app;
}
