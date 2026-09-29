import express, { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { currentUser, requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';
import { badRequest, notFound, parse } from '../errors.js';
import { logger } from '../logger.js';
import { getOrder, markPaid, markPaymentFailed } from '../orders/service.js';
import { verifyPaymentSignature, verifyWebhookSignature } from '../payments/signatures.js';
import { uuid } from './schemas.js';

export const paymentsRouter = Router();
const json = express.json({ limit: '20kb' });

async function paymentForCustomer(orderId: string, customerId: string) {
  const { rows } = await pool.query(
    `select p.provider, p.provider_order_id from payments p join orders o on o.id = p.order_id
      where o.id = $1 and o.customer_id = $2`,
    [orderId, customerId],
  );
  if (!rows[0]) throw notFound('Payment not found');
  return rows[0] as { provider: string; provider_order_id: string };
}

paymentsRouter.post('/payments/razorpay/verify', json, requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.object({
      orderId: uuid,
      razorpayOrderId: z.string().min(1),
      razorpayPaymentId: z.string().min(1),
      razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    req.body,
  );
  const payment = await paymentForCustomer(body.orderId, user.uid);
  if (payment.provider !== 'razorpay' || payment.provider_order_id !== body.razorpayOrderId) {
    throw badRequest('Payment does not belong to this order');
  }
  if (!verifyPaymentSignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature, config.RAZORPAY_KEY_SECRET!)) {
    throw badRequest('Payment signature is invalid');
  }
  await markPaid(body.razorpayOrderId, body.razorpayPaymentId);
  res.json({ order: await getOrder(pool, body.orderId, { role: 'customer', uid: user.uid }) });
});

if (config.paymentsMode === 'mock') {
  paymentsRouter.post('/payments/mock/confirm', json, requireAuth, async (req, res) => {
    const user = currentUser(req);
    const { orderId } = parse(z.object({ orderId: uuid }), req.body);
    const payment = await paymentForCustomer(orderId, user.uid);
    if (payment.provider !== 'mock') throw badRequest('Not a mock payment');
    await markPaid(payment.provider_order_id, `mockpay_${Date.now()}`);
    res.json({ order: await getOrder(pool, orderId, { role: 'customer', uid: user.uid }) });
  });
}

// Razorpay retries webhooks, so every handler here must be idempotent.
paymentsRouter.post('/webhooks/razorpay', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  const signature = req.header('X-Razorpay-Signature');
  const secret = config.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !Buffer.isBuffer(req.body) || !verifyWebhookSignature(req.body, signature, secret)) {
    res.status(400).json({ error: { code: 'bad_signature', message: 'Invalid webhook signature' } });
    return;
  }

  const event = JSON.parse(req.body.toString('utf8'));
  const entity = event?.payload?.payment?.entity;
  try {
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && entity?.order_id) {
      await markPaid(entity.order_id, entity.id);
    } else if (event.event === 'payment.failed' && entity?.order_id) {
      await markPaymentFailed(entity.order_id);
    }
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      logger.warn({ event: event.event, providerOrderId: entity?.order_id }, 'webhook for unknown payment');
    } else {
      throw err;
    }
  }
  res.json({ received: true });
});
