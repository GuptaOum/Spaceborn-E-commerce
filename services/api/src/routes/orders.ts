import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { currentUser, requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';
import { badRequest, parse } from '../errors.js';
import { MAX_ITEMS_PER_LINE } from '../orders/pricing.js';
import { getOrder, listCustomerOrders, placeOrder, transitionOrder } from '../orders/service.js';
import { deliveryAddress, uuid } from './schemas.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const placeOrderLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'anonymous',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const placeOrderBody = z.object({
  storeId: uuid,
  items: z
    .array(z.object({ productId: uuid, quantity: z.number().int().min(1).max(MAX_ITEMS_PER_LINE) }))
    .min(1)
    .max(40),
  address: deliveryAddress,
});

ordersRouter.post('/', placeOrderLimiter, async (req, res) => {
  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) {
    throw badRequest('Idempotency-Key header (8-80 url-safe characters) is required');
  }
  const body = parse(placeOrderBody, req.body);
  const result = await placeOrder({ ...body, customerId: currentUser(req).uid, idempotencyKey });
  res.status(201).json(result);
});

ordersRouter.get('/', async (req, res) => {
  const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }), req.query);
  res.json({ orders: await listCustomerOrders(currentUser(req).uid, limit) });
});

ordersRouter.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const order = await getOrder(pool, parse(uuid, req.params.id), { role: 'customer', uid: user.uid });
  res.json({ order });
});

ordersRouter.post('/:id/cancel', async (req, res) => {
  const user = currentUser(req);
  const { reason } = parse(z.object({ reason: z.string().trim().max(300).optional() }), req.body ?? {});
  const order = await transitionOrder({
    orderId: parse(uuid, req.params.id),
    to: 'cancelled',
    actor: { role: 'customer', uid: user.uid },
    reason: reason || 'Cancelled by customer',
  });
  res.json({ order });
});
