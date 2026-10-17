import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { currentUser, requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';
import { badRequest, conflict, parse } from '../errors.js';
import { MAX_ITEMS_PER_LINE } from '../orders/pricing.js';
import { checkoutPayload, getOrder, listCustomerOrders, placeOrder, transitionOrder } from '../orders/service.js';
import { subscribeTracking, trackingSnapshot } from '../orders/tracking.js';
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

// No storeId: which store fulfils a cart is the server's decision, never the client's.
const placeOrderBody = z.object({
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

// Live delivery tracking as a server-sent stream. Opens with a full snapshot, then pushes rider
// positions and status changes as the store's rider shares them. A slow poll backs up pub/sub so a
// missed message is a late update, not a stuck map. Closes once the order reaches a final status.
const TRACK_POLL_MS = 7_000;
const TRACK_PING_MS = 15_000;
const TRACK_MAX_MS = 30 * 60_000;

ordersRouter.get('/:id/track', async (req, res) => {
  const user = currentUser(req);
  const orderId = parse(uuid, req.params.id);
  // Throws 404 before any headers are sent when the order is not this customer's.
  let snapshot = await trackingSnapshot(orderId, user.uid);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let open = true;
  const send = (event: string, data: unknown) => {
    if (!open) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send('snapshot', snapshot);
  if (!snapshot.live) {
    res.end();
    return;
  }

  let unsubscribe: (() => Promise<void>) | null = null;
  const close = () => {
    if (!open) return;
    open = false;
    clearInterval(poll);
    clearInterval(ping);
    clearTimeout(cap);
    void unsubscribe?.();
    res.end();
  };

  const refresh = async () => {
    try {
      const next = await trackingSnapshot(orderId, user.uid);
      const changed = JSON.stringify(next) !== JSON.stringify(snapshot);
      snapshot = next;
      if (changed) send('snapshot', next);
      if (!next.live) close();
    } catch {
      close();
    }
  };

  const poll = setInterval(() => void refresh(), TRACK_POLL_MS);
  const ping = setInterval(() => open && res.write(': ping\n\n'), TRACK_PING_MS);
  const cap = setTimeout(close, TRACK_MAX_MS);
  req.on('close', close);

  unsubscribe = await subscribeTracking(orderId, (event) => {
    if (event.type === 'position') {
      snapshot = { ...snapshot, rider: { lat: event.lat, lng: event.lng, at: event.at, remainingKm: event.remainingKm, etaMinutes: event.etaMinutes } };
      send('position', snapshot.rider);
    } else {
      // The status message says what changed; the snapshot that follows carries the rest.
      send('status', { status: event.status });
      void refresh();
    }
  });
  if (!open) void unsubscribe();
});

// Resume a checkout the customer left in Razorpay. The reservation and the provider order already exist.
ordersRouter.post('/:id/pay', async (req, res) => {
  const user = currentUser(req);
  const payload = await checkoutPayload(parse(uuid, req.params.id), user.uid);
  if (payload.order.status !== 'pending_payment') throw conflict('This order is not waiting for payment');
  const until = payload.order.reservedUntil as string | null;
  if (!until || new Date(until).getTime() <= Date.now()) {
    throw conflict('The reservation expired. Place the order again.');
  }
  if (!payload.payment || payload.payment.status === 'captured') throw conflict('Payment is not open for this order');
  res.json(payload);
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
