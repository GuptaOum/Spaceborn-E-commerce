import crypto from 'node:crypto';
import type pg from 'pg';
import { config } from '../config.js';
import { pool, withTransaction, type Db } from '../db/pool.js';
import { conflict, forbidden, HttpError, notFound, unprocessable } from '../errors.js';
import { haversineKm } from '../lib/geo.js';
import { logger } from '../logger.js';
import { enqueue } from '../outbox.js';
import { markFabPaid } from '../fabrication/service.js';
import { createProviderOrder } from '../payments/razorpay.js';
import { etaMinutes, MAX_ITEMS_PER_LINE, priceOrder, RESERVATION_MINUTES, toPaise } from './pricing.js';
import { canTransition, HOLDS_STOCK, PAID_STATUSES, type Actor, type OrderStatus } from './status.js';

export interface DeliveryAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export interface PlaceOrderInput {
  customerId: string;
  storeId: string;
  idempotencyKey: string;
  items: { productId: string; quantity: number }[];
  address: DeliveryAddress;
}

export interface ActorContext {
  role: Actor;
  uid: string | null;
  storeId?: string | null;
}

class IdempotentReplay extends Error {}

const ORDER_SELECT = `
  select o.id, o.order_number as "orderNumber", o.status, o.customer_id as "customerId",
         o.store_id as "storeId", s.name as "storeName", s.phone as "storePhone",
         o.items_total as "itemsTotal", o.delivery_fee as "deliveryFee", o.platform_fee as "platformFee",
         o.grand_total as "grandTotal", o.delivery_address as "deliveryAddress", o.distance_km as "distanceKm",
         o.eta_minutes as "etaMinutes", o.handover_otp as "handoverOtp", o.reserved_until as "reservedUntil",
         o.cancel_reason as "cancelReason", o.placed_at as "placedAt", o.accepted_at as "acceptedAt",
         o.delivered_at as "deliveredAt", o.created_at as "createdAt", p.status as "paymentStatus",
         coalesce((
           select json_agg(json_build_object(
             'productId', oi.product_id, 'name', oi.name, 'sku', oi.sku, 'imageUrl', oi.image_url,
             'unitPrice', oi.unit_price, 'quantity', oi.quantity, 'lineTotal', oi.line_total
           ) order by oi.name)
           from order_items oi where oi.order_id = o.id
         ), '[]'::json) as items
    from orders o
    join stores s on s.id = o.store_id
    left join payments p on p.order_id = o.id`;

export type OrderView = Record<string, unknown> & { id: string; status: OrderStatus; handoverOtp?: string };

const withoutOtp = (order: OrderView): OrderView => {
  const { handoverOtp: _otp, ...rest } = order;
  return rest as OrderView;
};

export async function getOrder(db: Db, orderId: string, viewer: ActorContext): Promise<OrderView> {
  const { rows } = await db.query<OrderView>(`${ORDER_SELECT} where o.id = $1`, [orderId]);
  const order = rows[0];
  if (!order || !canView(order, viewer)) throw notFound('Order not found');

  const history = await db.query(
    `select from_status as "from", to_status as "to", actor_role as "actorRole", note, created_at as "at"
       from order_status_history where order_id = $1 order by created_at`,
    [orderId],
  );
  const view = { ...order, history: history.rows };
  return viewer.role === 'customer' ? view : withoutOtp(view);
}

function canView(order: OrderView, viewer: ActorContext) {
  if (viewer.role === 'admin' || viewer.role === 'system') return true;
  if (viewer.role === 'vendor') return order.storeId === viewer.storeId;
  return order.customerId === viewer.uid;
}

export async function listCustomerOrders(customerId: string, limit: number) {
  const { rows } = await pool.query<OrderView>(
    `${ORDER_SELECT} where o.customer_id = $1 order by o.created_at desc limit $2`,
    [customerId, limit],
  );
  return rows;
}

export async function listStoreOrders(storeId: string, statuses: OrderStatus[] | null, limit: number) {
  const { rows } = await pool.query<OrderView>(
    `${ORDER_SELECT}
      where o.store_id = $1 and o.status <> 'pending_payment' and ($2::order_status[] is null or o.status = any($2))
      order by o.created_at desc limit $3`,
    [storeId, statuses, limit],
  );
  return rows.map(withoutOtp);
}

export async function listAllOrders(statuses: OrderStatus[] | null, limit: number) {
  const { rows } = await pool.query<OrderView>(
    `${ORDER_SELECT} where ($1::order_status[] is null or o.status = any($1)) order by o.created_at desc limit $2`,
    [statuses, limit],
  );
  return rows.map(withoutOtp);
}

async function recordStatus(db: Db, orderId: string, from: OrderStatus | null, to: OrderStatus, actor: ActorContext, note?: string) {
  await db.query(
    `insert into order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
     values ($1, $2, $3, $4, $5, $6)`,
    [orderId, from, to, actor.uid, actor.role, note ?? null],
  );
}

async function releaseStock(db: Db, orderId: string) {
  await db.query(
    `update inventory i set stock = i.stock + oi.quantity
       from order_items oi join orders o on o.id = oi.order_id
      where oi.order_id = $1 and i.store_id = o.store_id and i.product_id = oi.product_id`,
    [orderId],
  );
}

function mergeLines(items: PlaceOrderInput['items']) {
  const quantities = new Map<string, number>();
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }
  for (const [productId, quantity] of quantities) {
    if (quantity > MAX_ITEMS_PER_LINE) {
      throw unprocessable('quantity_limit', `You can order at most ${MAX_ITEMS_PER_LINE} of one item`, { productId });
    }
  }
  return quantities;
}

export async function checkoutPayload(orderId: string, customerId: string) {
  const order = await getOrder(pool, orderId, { role: 'customer', uid: customerId });
  const { rows } = await pool.query(
    `select provider, provider_order_id as "providerOrderId", amount_paise as "amountPaise", status
       from payments where order_id = $1`,
    [orderId],
  );
  const payment = rows[0];
  return {
    order,
    payment: payment && {
      ...payment,
      currency: 'INR',
      keyId: payment.provider === 'razorpay' ? config.RAZORPAY_KEY_ID : null,
    },
  };
}

export async function placeOrder(input: PlaceOrderInput) {
  const quantities = mergeLines(input.items);
  const productIds = [...quantities.keys()];

  const existing = await pool.query<{ id: string }>(
    'select id from orders where customer_id = $1 and idempotency_key = $2',
    [input.customerId, input.idempotencyKey],
  );
  if (existing.rows[0]) return checkoutPayload(existing.rows[0].id, input.customerId);

  let orderId: string;
  let grandTotal: number;
  try {
    ({ orderId, grandTotal } = await withTransaction(async (c) => {
      const storeResult = await c.query(
        `select id, latitude, longitude, delivery_radius_km, avg_prep_minutes
           from stores where id = $1 and status = 'approved' and is_online for share`,
        [input.storeId],
      );
      const store = storeResult.rows[0];
      if (!store) throw unprocessable('store_unavailable', 'This store is not taking orders right now');

      const distanceKm = haversineKm(store.latitude, store.longitude, input.address.latitude, input.address.longitude);
      if (distanceKm > store.delivery_radius_km) {
        throw unprocessable('out_of_range', 'This store does not deliver to your location');
      }

      const inventory = await c.query(
        `select i.product_id, i.price, i.stock, i.is_listed, p.is_active, p.name, p.sku, p.image_url
           from inventory i join products p on p.id = i.product_id
          where i.store_id = $1 and i.product_id = any($2::uuid[])
          order by i.product_id
          for update of i`,
        [input.storeId, productIds],
      );
      const byId = new Map(inventory.rows.map((row) => [row.product_id as string, row]));

      const problems: { productId: string; reason: string; available?: number }[] = [];
      for (const [productId, quantity] of quantities) {
        const row = byId.get(productId);
        if (!row || !row.is_listed || !row.is_active) problems.push({ productId, reason: 'unavailable' });
        else if (row.stock < quantity) problems.push({ productId, reason: 'insufficient_stock', available: row.stock });
      }
      if (problems.length) throw conflict('Some items in your cart are no longer available', { items: problems });

      const lines = productIds.map((productId) => ({ ...byId.get(productId)!, quantity: quantities.get(productId)! }));
      const pricing = priceOrder(lines.map((l) => ({ unitPrice: l.price, quantity: l.quantity })), distanceKm);

      await c.query(
        `update inventory i set stock = i.stock - x.qty
           from unnest($2::uuid[], $3::int[]) as x(product_id, qty)
          where i.store_id = $1 and i.product_id = x.product_id`,
        [input.storeId, productIds, productIds.map((id) => quantities.get(id))],
      );

      const inserted = await c.query<{ id: string }>(
        `insert into orders (customer_id, store_id, items_total, delivery_fee, platform_fee, grand_total,
                             delivery_address, delivery_lat, delivery_lng, distance_km, eta_minutes,
                             handover_otp, reserved_until, idempotency_key)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now() + make_interval(mins => $13), $14)
         on conflict (customer_id, idempotency_key) do nothing
         returning id`,
        [
          input.customerId, input.storeId, pricing.itemsTotal, pricing.deliveryFee, pricing.platformFee,
          pricing.grandTotal, JSON.stringify(input.address), input.address.latitude, input.address.longitude,
          Math.round(distanceKm * 100) / 100, etaMinutes(store.avg_prep_minutes, distanceKm),
          crypto.randomInt(1000, 10000).toString(), RESERVATION_MINUTES, input.idempotencyKey,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new IdempotentReplay();

      await c.query(
        `insert into order_items (order_id, product_id, name, sku, image_url, unit_price, quantity, line_total)
         select $1, x.product_id, x.name, x.sku, x.image_url, x.unit_price, x.quantity, x.unit_price * x.quantity
           from unnest($2::uuid[], $3::text[], $4::text[], $5::text[], $6::numeric[], $7::int[])
             as x(product_id, name, sku, image_url, unit_price, quantity)`,
        [
          id,
          lines.map((l) => l.product_id),
          lines.map((l) => l.name),
          lines.map((l) => l.sku),
          lines.map((l) => l.image_url),
          lines.map((l) => l.price),
          lines.map((l) => l.quantity),
        ],
      );
      await recordStatus(c, id, null, 'pending_payment', { role: 'customer', uid: input.customerId });
      return { orderId: id, grandTotal: pricing.grandTotal };
    }));
  } catch (err) {
    if (err instanceof IdempotentReplay) {
      const replay = await pool.query<{ id: string }>(
        'select id from orders where customer_id = $1 and idempotency_key = $2',
        [input.customerId, input.idempotencyKey],
      );
      return checkoutPayload(replay.rows[0]!.id, input.customerId);
    }
    throw err;
  }

  try {
    const amountPaise = toPaise(grandTotal);
    const providerOrderId =
      config.paymentsMode === 'razorpay' ? (await createProviderOrder(orderId, amountPaise)).providerOrderId : `mock_${orderId}`;
    await pool.query(
      'insert into payments (order_id, provider, provider_order_id, amount_paise) values ($1, $2, $3, $4)',
      [orderId, config.paymentsMode, providerOrderId, amountPaise],
    );
  } catch (err) {
    logger.error({ err, orderId }, 'payment initialisation failed, releasing stock');
    await transitionOrder({ orderId, to: 'cancelled', actor: { role: 'system', uid: null }, reason: 'Payment could not be started' });
    throw new HttpError(502, 'payment_unavailable', 'Payments are temporarily unavailable. Please try again.');
  }

  return checkoutPayload(orderId, input.customerId);
}

export async function markPaid(providerOrderId: string, providerPaymentId: string) {
  return withTransaction(async (c) => {
    const target = await c.query<{ order_id: string | null; fab_job_id: string | null }>(
      'select order_id, fab_job_id from payments where provider_order_id = $1',
      [providerOrderId],
    );
    if (!target.rows[0]) throw notFound('Payment not found');
    const { order_id: targetOrderId, fab_job_id: fabJobId } = target.rows[0];

    // Lock the order/job before the payment, the same order cancellations use, so the two cannot deadlock.
    const parent = fabJobId
      ? await c.query('select status from fab_jobs where id = $1 for update', [fabJobId])
      : await c.query('select status from orders where id = $1 for update', [targetOrderId]);
    const { rows: paymentRows } = await c.query(
      'select id as payment_id, status as payment_status, amount_paise from payments where provider_order_id = $1 for update',
      [providerOrderId],
    );
    const row = { ...paymentRows[0], order_id: targetOrderId, order_status: parent.rows[0]?.status };
    if (row.payment_status !== 'created' && row.payment_status !== 'failed') {
      return { orderId: (targetOrderId ?? fabJobId) as string, alreadyProcessed: true };
    }

    if (fabJobId) {
      await markFabPaid(c, fabJobId, row.payment_id, providerPaymentId, Number(row.amount_paise));
      return { orderId: fabJobId, alreadyProcessed: false };
    }

    const system: ActorContext = { role: 'system', uid: null };

    if (row.order_status === 'pending_payment') {
      await c.query(`update payments set status = 'captured', provider_payment_id = $2 where id = $1`, [row.payment_id, providerPaymentId]);
      await c.query(
        `update orders set status = 'placed', placed_at = now(), reserved_until = null where id = $1`,
        [row.order_id],
      );
      await recordStatus(c, row.order_id, 'pending_payment', 'placed', system, 'Payment received');
      await enqueue(c, 'order.placed', { orderId: row.order_id });
      return { orderId: row.order_id as string, alreadyProcessed: false };
    }

    // Paid after the reservation expired or the order was cancelled: the stock is gone, so refund.
    await c.query(
      `update payments set status = 'refund_pending', provider_payment_id = $2 where id = $1`,
      [row.payment_id, providerPaymentId],
    );
    await enqueue(c, 'refund.requested', {
      paymentId: row.payment_id,
      orderId: row.order_id,
      providerPaymentId,
      amountPaise: row.amount_paise,
    });
    logger.warn({ orderId: row.order_id, status: row.order_status }, 'payment captured for inactive order, refund queued');
    return { orderId: row.order_id as string, alreadyProcessed: false };
  });
}

export async function markPaymentFailed(providerOrderId: string) {
  await pool.query(`update payments set status = 'failed' where provider_order_id = $1 and status = 'created'`, [providerOrderId]);
}

export interface TransitionInput {
  orderId: string;
  to: OrderStatus;
  actor: ActorContext;
  reason?: string;
  otp?: string;
}

export async function transitionOrder(input: TransitionInput, db?: pg.PoolClient) {
  const run = async (c: pg.PoolClient) => {
    const { rows } = await c.query(
      `select o.id, o.status, o.customer_id, o.store_id, o.handover_otp,
              p.id as payment_id, p.status as payment_status, p.provider_payment_id, p.amount_paise
         from orders o left join payments p on p.order_id = o.id
        where o.id = $1
        for update of o`,
      [input.orderId],
    );
    const order = rows[0];
    const { actor } = input;
    if (!order) throw notFound('Order not found');
    if (actor.role === 'customer' && order.customer_id !== actor.uid) throw notFound('Order not found');
    if (actor.role === 'vendor' && order.store_id !== actor.storeId) throw notFound('Order not found');

    const from = order.status as OrderStatus;
    if (!canTransition(from, input.to, actor.role)) {
      throw conflict(`Order cannot move from ${from} to ${input.to}`);
    }
    if (input.to === 'delivered') {
      const otp = input.otp ?? '';
      const matches =
        otp.length === order.handover_otp.length && crypto.timingSafeEqual(Buffer.from(otp), Buffer.from(order.handover_otp));
      if (!matches) throw forbidden('Handover code does not match');
    }
    if (input.to === 'cancelled' && (actor.role === 'vendor' || actor.role === 'admin') && !input.reason) {
      throw unprocessable('reason_required', 'A cancellation reason is required');
    }

    if (HOLDS_STOCK.includes(from) && (input.to === 'cancelled' || input.to === 'expired')) {
      await releaseStock(c, order.id);
    }

    await c.query(
      `update orders set status = $2::order_status,
              accepted_at = case when $2::order_status = 'accepted' then now() else accepted_at end,
              delivered_at = case when $2::order_status = 'delivered' then now() else delivered_at end,
              cancel_reason = case when $2::order_status in ('cancelled', 'expired') then $3 else cancel_reason end,
              reserved_until = case when $2::order_status in ('cancelled', 'expired') then null else reserved_until end
        where id = $1`,
      [order.id, input.to, input.reason ?? null],
    );
    await recordStatus(c, order.id, from, input.to, actor, input.reason);

    if (input.to === 'cancelled' && PAID_STATUSES.includes(from) && order.payment_status === 'captured') {
      await c.query(`update payments set status = 'refund_pending' where order_id = $1`, [order.id]);
      await enqueue(c, 'refund.requested', {
        paymentId: order.payment_id,
        orderId: order.id,
        providerPaymentId: order.provider_payment_id,
        amountPaise: order.amount_paise,
      });
    }
    await enqueue(c, 'order.status_changed', { orderId: order.id, from, to: input.to });
    return order.id as string;
  };

  const orderId = db ? await run(db) : await withTransaction(run);
  return getOrder(db ?? pool, orderId, input.actor);
}

export async function expireReservations(batchSize = 50): Promise<number> {
  return withTransaction(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `select id from orders
        where status = 'pending_payment' and reserved_until < now()
        order by reserved_until
        limit $1
        for update skip locked`,
      [batchSize],
    );
    for (const { id } of rows) {
      await releaseStock(c, id);
      await c.query(`update orders set status = 'expired', reserved_until = null where id = $1`, [id]);
      await recordStatus(c, id, 'pending_payment', 'expired', { role: 'system', uid: null }, 'Payment not completed in time');
      await enqueue(c, 'order.status_changed', { orderId: id, from: 'pending_payment', to: 'expired' });
    }
    return rows.length;
  });
}
