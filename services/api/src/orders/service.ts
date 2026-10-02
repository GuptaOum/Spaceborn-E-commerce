import crypto from 'node:crypto';
import type pg from 'pg';
import { config } from '../config.js';
import { pool, withTransaction, type Db } from '../db/pool.js';
import { conflict, forbidden, HttpError, notFound, unprocessable } from '../errors.js';
import { logger } from '../logger.js';
import { bumpCatalog } from '../cache.js';
import { enqueue } from '../outbox.js';
import { markFabPaid } from '../fabrication/service.js';
import { createProviderOrder } from '../payments/razorpay.js';
import { allocateNearest, availabilityNearby, classifyShortfall, rankStores, type StoreSlice } from './fulfilment.js';
import { deliveryFee, etaMinutes, MAX_ITEMS_PER_LINE, PLATFORM_FEE, RESERVATION_MINUTES, toPaise } from './pricing.js';
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
         o.eta_minutes as "etaMinutes",
         case when o.handover_otp_expires_at > now() then o.handover_otp end as "handoverOtp",
         o.handover_otp_sent_at as "handoverOtpSentAt", o.handover_otp_expires_at as "handoverOtpExpiresAt",
         o.reserved_until as "reservedUntil",
         o.cancel_reason as "cancelReason", o.placed_at as "placedAt", o.accepted_at as "acceptedAt",
         o.delivered_at as "deliveredAt", o.created_at as "createdAt", o.checkout_id as "checkoutId",
         p.status as "paymentStatus",
         coalesce((
           select json_agg(json_build_object(
             'productId', oi.product_id, 'name', oi.name, 'sku', oi.sku, 'imageUrl', oi.image_url,
             'unitPrice', oi.unit_price, 'quantity', oi.quantity, 'lineTotal', oi.line_total
           ) order by oi.name)
           from order_items oi where oi.order_id = o.id
         ), '[]'::json) as items
    from orders o
    join stores s on s.id = o.store_id
    left join payments p on p.order_id = o.id or (o.checkout_id is not null and p.checkout_id = o.checkout_id)`;

export type OrderView = Record<string, unknown> & { id: string; status: OrderStatus; handoverOtp?: string };

const withoutOtp = (order: OrderView): OrderView => {
  const { handoverOtp: _otp, ...rest } = order;
  return rest as OrderView;
};

// Customers buy from the platform, not from a shop: the shop behind a delivery stays private.
const withoutStore = (order: OrderView): OrderView => {
  const { storeId: _id, storeName: _name, storePhone: _phone, ...rest } = order;
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
  return viewer.role === 'customer' ? withoutStore(view) : withoutOtp(view);
}

function canView(order: OrderView, viewer: ActorContext) {
  if (viewer.role === 'admin' || viewer.role === 'system') return true;
  if (viewer.role === 'vendor') return order.storeId === viewer.storeId;
  return order.customerId === viewer.uid;
}

export async function listCustomerOrders(customerId: string, limit: number) {
  // A split checkout is shown as one purchase, so every delivery of a listed checkout comes along
  // even when the page limit would have cut the group in half.
  const { rows } = await pool.query<OrderView>(
    `with page as (
       select id, checkout_id from orders where customer_id = $1 order by created_at desc limit $2
     )
     ${ORDER_SELECT}
      where o.customer_id = $1
        and (o.id in (select id from page)
             or o.checkout_id in (select checkout_id from page where checkout_id is not null))
      order by o.created_at desc`,
    [customerId, limit],
  );
  return rows.map(withoutStore);
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

/** `cities` is an admin's lower-cased region list; null means every city. */
export async function listAllOrders(statuses: OrderStatus[] | null, limit: number, cities: string[] | null = null) {
  const { rows } = await pool.query<OrderView>(
    `${ORDER_SELECT}
      where ($1::order_status[] is null or o.status = any($1))
        and ($3::text[] is null or lower(btrim(s.city)) = any($3))
      order by o.created_at desc limit $2`,
    [statuses, limit, cities],
  );
  return rows.map(withoutOtp);
}

/** The city an order's store sits in, or null when the order does not exist. */
export async function orderCity(orderId: string): Promise<string | null> {
  const { rows } = await pool.query<{ city: string }>(
    'select s.city from orders o join stores s on s.id = o.store_id where o.id = $1',
    [orderId],
  );
  return rows[0]?.city ?? null;
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
       from payments
      where order_id = $1
         or checkout_id = (select checkout_id from orders where id = $1)`,
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

async function writeSplit(c: Db, slices: StoreSlice[], input: PlaceOrderInput) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const locked = [...slices].sort((a, b) => a.storeId.localeCompare(b.storeId));
  for (const slice of locked) {
    const store = await c.query(
      `select id from stores where id = $1 and status = 'approved' and is_online for share`,
      [slice.storeId],
    );
    if (!store.rows[0]) throw unprocessable('store_unavailable', 'A store near you just stopped taking orders. Please try again.');
    const productIds = slice.lines.map((line) => line.productId);
    // Re-read stock, listing and price under the row lock. The allocation ran without locks, so a
    // vendor may have unlisted or repriced in between; a 409 sends the caller back to allocate
    // with the fresh rows rather than charging a price the customer never saw.
    const inventory = await c.query<{ product_id: string; stock: number; price: string; sellable: boolean }>(
      `select i.product_id, i.stock, i.price, (i.is_listed and p.is_active) as sellable
         from inventory i join products p on p.id = i.product_id
        where i.store_id = $1 and i.product_id = any($2::uuid[])
        order by i.product_id
        for update of i`,
      [slice.storeId, productIds],
    );
    const rows = new Map(inventory.rows.map((row) => [row.product_id, row]));
    for (const line of slice.lines) {
      const row = rows.get(line.productId);
      if (!row || !row.sellable || row.stock < line.quantity) {
        throw conflict('Some items in your cart are no longer available');
      }
      if (Number(row.price) !== line.unitPrice) {
        throw conflict('A price changed while you were checking out', { code: 'price_changed' });
      }
    }
    await c.query(
      `update inventory i set stock = i.stock - x.qty
         from unnest($2::uuid[], $3::int[]) as x(product_id, qty)
        where i.store_id = $1 and i.product_id = x.product_id`,
      [slice.storeId, productIds, slice.lines.map((line) => line.quantity)],
    );
  }

  let itemsTotal = 0;
  let deliverySum = 0;
  const parts = slices.map((slice) => {
    const items = round2(slice.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
    const fee = deliveryFee(items, slice.distanceKm);
    itemsTotal += items;
    deliverySum += fee;
    return { slice, items, fee };
  });
  const grandTotal = round2(itemsTotal + deliverySum + PLATFORM_FEE);
  // Two in-flight requests with the same key both get here; the unique key lets the loser replay.
  const checkout = await c.query<{ id: string }>(
    `insert into checkouts (customer_id, idempotency_key, items_total, delivery_fee, platform_fee, grand_total, delivery_address)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (customer_id, idempotency_key) do nothing
     returning id`,
    [
      input.customerId,
      input.idempotencyKey,
      round2(itemsTotal),
      round2(deliverySum),
      PLATFORM_FEE,
      grandTotal,
      JSON.stringify(input.address),
    ],
  );
  const checkoutId = checkout.rows[0]?.id;
  if (!checkoutId) throw new IdempotentReplay();
  let firstId = '';
  for (const [index, part] of parts.entries()) {
    // The platform fee is charged once per checkout and booked on the first delivery, so the
    // per-order totals add up to the payment and a refund of every delivery returns all of it.
    const platformFee = index === 0 ? PLATFORM_FEE : 0;
    const inserted = await c.query<{ id: string }>(
      `insert into orders (customer_id, store_id, checkout_id, items_total, delivery_fee, platform_fee, grand_total,
                           delivery_address, delivery_lat, delivery_lng, distance_km, eta_minutes,
                           reserved_until, idempotency_key)
       values ($1, $2, $3, $4, $5, $14, $6, $7, $8, $9, $10, $11, now() + make_interval(mins => $12), $13)
       returning id`,
      [
        input.customerId,
        part.slice.storeId,
        checkoutId,
        part.items,
        part.fee,
        round2(part.items + part.fee + platformFee),
        JSON.stringify(input.address),
        input.address.latitude,
        input.address.longitude,
        Math.round(part.slice.distanceKm * 100) / 100,
        etaMinutes(part.slice.prepMinutes, part.slice.distanceKm),
        RESERVATION_MINUTES,
        `${input.idempotencyKey}:${index + 1}`,
        platformFee,
      ],
    );
    const id = inserted.rows[0]!.id;
    if (!firstId) firstId = id;
    const lines = part.slice.lines;
    await c.query(
      `insert into order_items (order_id, product_id, name, sku, image_url, unit_price, quantity, line_total)
       select $1, x.product_id, x.name, x.sku, x.image_url, x.unit_price, x.quantity, x.unit_price * x.quantity
         from unnest($2::uuid[], $3::text[], $4::text[], $5::text[], $6::numeric[], $7::int[])
           as x(product_id, name, sku, image_url, unit_price, quantity)`,
      [
        id,
        lines.map((line) => line.productId),
        lines.map((line) => line.name),
        lines.map((line) => line.sku),
        lines.map((line) => line.imageUrl),
        lines.map((line) => line.unitPrice),
        lines.map((line) => line.quantity),
      ],
    );
    await recordStatus(c, id, null, 'pending_payment', { role: 'customer', uid: input.customerId });
  }
  return { orderId: firstId, grandTotal, checkoutId };
}

export async function placeOrder(input: PlaceOrderInput) {
  const quantities = mergeLines(input.items);
  const productIds = [...quantities.keys()];

  const existing = await pool.query<{ id: string }>(
    `select o.id from orders o
       left join checkouts c on c.id = o.checkout_id
      where o.customer_id = $1 and (o.idempotency_key = $2 or c.idempotency_key = $2)
      order by o.created_at
      limit 1`,
    [input.customerId, input.idempotencyKey],
  );
  if (existing.rows[0]) return checkoutPayload(existing.rows[0].id, input.customerId);

  let orderId: string;
  let grandTotal: number;
  let checkoutId: string | null = null;
  try {
    ({ orderId, grandTotal, checkoutId } = await withTransaction(async (c) => {
      // Always fill from the nearest shops first, even when one farther shop could cover the
      // whole cart. The customer bought the pooled stock; leftover units at a closer shop sell.
      // A savepoint lets a lost race (stock sold, shop went offline, price changed) roll back and
      // allocate again from the rows as they are now.
      const ranked = await rankStores(c, input.address.latitude, input.address.longitude, quantities);
      if (!ranked.length) throw unprocessable('unserviceable', 'No store delivers to your location yet');

      let placed: { orderId: string; grandTotal: number; checkoutId: string | null } | undefined;
      let lastShort: { productId: string; available: number }[] = [];
      const ATTEMPTS = 3;
      for (let n = 0; n < ATTEMPTS && !placed; n++) {
        const alloc = await allocateNearest(c, input.address.latitude, input.address.longitude, quantities);
        if (alloc.short.length || !alloc.slices.length) {
          lastShort = alloc.short;
          break;
        }
        await c.query('savepoint split');
        try {
          placed = await writeSplit(c, alloc.slices, input);
          await c.query('release savepoint split');
        } catch (err) {
          await c.query('rollback to savepoint split');
          await c.query('release savepoint split');
          const retryable = err instanceof HttpError && (err.status === 409 || err.code === 'store_unavailable');
          if (!retryable || n === ATTEMPTS - 1) throw err;
        }
      }

      if (!placed) {
        const nearby = await availabilityNearby(c, input.address.latitude, input.address.longitude, productIds);
        const best = ranked[0]!;
        const offered = await c.query<{ product_id: string; stock: number }>(
          `select i.product_id, i.stock from inventory i join products p on p.id = i.product_id
            where i.store_id = $1 and i.product_id = any($2::uuid[]) and i.is_listed and p.is_active`,
          [best.storeId, productIds],
        );
        const items = classifyShortfall(quantities, new Map(offered.rows.map((r) => [r.product_id, r.stock])), nearby);
        throw conflict('Some items in your cart are not available near you', {
          code: 'partial_availability',
          items: items.map((item) => ({
            ...item,
            available: lastShort.find((s) => s.productId === item.productId)?.available ?? item.availableNearby,
          })),
        });
      }
      return placed;
    }));
  } catch (err) {
    if (err instanceof IdempotentReplay) {
      const replay = await pool.query<{ id: string }>(
        `select o.id from orders o
           left join checkouts c on c.id = o.checkout_id
          where o.customer_id = $1 and (o.idempotency_key = $2 or c.idempotency_key = $2)
          order by o.created_at
          limit 1`,
        [input.customerId, input.idempotencyKey],
      );
      if (!replay.rows[0]) throw conflict('This checkout is already being processed. Please refresh your orders.');
      return checkoutPayload(replay.rows[0].id, input.customerId);
    }
    throw err;
  }

  void bumpCatalog();

  try {
    const amountPaise = toPaise(grandTotal);
    const providerOrderId =
      config.paymentsMode === 'razorpay' ? (await createProviderOrder(orderId, amountPaise)).providerOrderId : `mock_${orderId}`;
    await pool.query(
      `insert into payments (order_id, checkout_id, provider, provider_order_id, amount_paise) values ($1, $2, $3, $4, $5)`,
      [checkoutId ? null : orderId, checkoutId, config.paymentsMode, providerOrderId, amountPaise],
    );
  } catch (err) {
    logger.error({ err, orderId, checkoutId }, 'payment initialisation failed, releasing stock');
    const related = checkoutId
      ? await pool.query<{ id: string }>('select id from orders where checkout_id = $1', [checkoutId])
      : { rows: [{ id: orderId }] };
    for (const row of related.rows) {
      await transitionOrder({ orderId: row.id, to: 'cancelled', actor: { role: 'system', uid: null }, reason: 'Payment could not be started' });
    }
    throw new HttpError(502, 'payment_unavailable', 'Payments are temporarily unavailable. Please try again.');
  }

  return checkoutPayload(orderId, input.customerId);
}

export async function markPaid(providerOrderId: string, providerPaymentId: string) {
  return withTransaction(async (c) => {
    const target = await c.query<{ order_id: string | null; fab_job_id: string | null; checkout_id: string | null }>(
      'select order_id, fab_job_id, checkout_id from payments where provider_order_id = $1',
      [providerOrderId],
    );
    if (!target.rows[0]) throw notFound('Payment not found');
    const { order_id: targetOrderId, fab_job_id: fabJobId, checkout_id: checkoutId } = target.rows[0];

    if (checkoutId) {
      const orders = await c.query<{ id: string; status: string }>(
        'select id, status from orders where checkout_id = $1 order by id for update',
        [checkoutId],
      );
      const { rows: paymentRows } = await c.query(
        'select id as payment_id, status as payment_status, amount_paise from payments where provider_order_id = $1 for update',
        [providerOrderId],
      );
      const payment = paymentRows[0];
      if (payment.payment_status !== 'created' && payment.payment_status !== 'failed') {
        return { orderId: orders.rows[0]?.id ?? checkoutId, alreadyProcessed: true };
      }
      const system: ActorContext = { role: 'system', uid: null };
      if (orders.rows.length > 0 && orders.rows.every((order) => order.status === 'pending_payment')) {
        await c.query(`update payments set status = 'captured', provider_payment_id = $2 where id = $1`, [payment.payment_id, providerPaymentId]);
        for (const order of orders.rows) {
          await c.query(`update orders set status = 'placed', placed_at = now(), reserved_until = null where id = $1`, [order.id]);
          await recordStatus(c, order.id, 'pending_payment', 'placed', system, 'Payment received');
          await enqueue(c, 'order.placed', { orderId: order.id });
        }
        return { orderId: orders.rows[0]!.id, alreadyProcessed: false };
      }
      await c.query(`update payments set status = 'refund_pending', provider_payment_id = $2 where id = $1`, [payment.payment_id, providerPaymentId]);
      await enqueue(c, 'refund.requested', {
        paymentId: payment.payment_id,
        orderId: orders.rows[0]?.id ?? null,
        providerPaymentId,
        amountPaise: payment.amount_paise,
      });
      return { orderId: orders.rows[0]?.id ?? checkoutId, alreadyProcessed: false };
    }

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
      `select o.id, o.status, o.customer_id, o.store_id, o.handover_otp, o.grand_total, o.checkout_id,
              (o.handover_otp_expires_at > now()) as otp_live,
              p.id as payment_id, p.status as payment_status, p.provider_payment_id, p.amount_paise
         from orders o
         left join payments p on p.order_id = o.id or (o.checkout_id is not null and p.checkout_id = o.checkout_id)
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
      // The code only exists after the vendor asked for it at the door, and it does not live long.
      if (!order.handover_otp) throw conflict('Send the delivery code to the customer first');
      if (!order.otp_live) throw conflict('The delivery code has expired. Send a new one to the customer');
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

    // Each order refunds exactly what it was charged. For a split checkout the platform fee sits on
    // the first delivery, so the parts add up to the payment and the worker's ledger stops a
    // second delivery from refunding the whole payment again.
    if (
      input.to === 'cancelled' &&
      PAID_STATUSES.includes(from) &&
      (order.payment_status === 'captured' || order.payment_status === 'refund_pending')
    ) {
      await c.query(`update payments set status = 'refund_pending' where id = $1 and status = 'captured'`, [order.payment_id]);
      await enqueue(c, 'refund.requested', {
        paymentId: order.payment_id,
        orderId: order.id,
        providerPaymentId: order.provider_payment_id,
        amountPaise: toPaise(Number(order.grand_total)),
      });
    }
    await enqueue(c, 'order.status_changed', { orderId: order.id, from, to: input.to });
    return order.id as string;
  };

  const orderId = db ? await run(db) : await withTransaction(run);
  if (input.to === 'cancelled' || input.to === 'expired') void bumpCatalog();
  return getOrder(db ?? pool, orderId, input.actor);
}

export const HANDOVER_OTP_TTL_MINUTES = 10;
export const HANDOVER_OTP_RESEND_SECONDS = 45;

export interface HandoverOtpReceipt {
  orderId: string;
  sentAt: string;
  expiresAt: string;
}

// Called by the vendor when they are standing in front of the customer. Mints a fresh 4-digit
// code for this order only, stores it with a short expiry, and queues the message to the
// customer. The vendor never sees the code; the customer reads it back to them.
export async function requestHandoverOtp(orderId: string, actor: ActorContext): Promise<HandoverOtpReceipt> {
  return withTransaction(async (c) => {
    const { rows } = await c.query<{
      id: string;
      status: OrderStatus;
      store_id: string;
      sent_at: Date | null;
      resend_in: number | null;
    }>(
      `select id, status, store_id, handover_otp_sent_at as sent_at,
              greatest(0, ceil(extract(epoch from (handover_otp_sent_at + make_interval(secs => $2) - now()))))::int as resend_in
         from orders where id = $1 for update`,
      [orderId, HANDOVER_OTP_RESEND_SECONDS],
    );
    const order = rows[0];
    if (!order) throw notFound('Order not found');
    if (actor.role === 'vendor' && order.store_id !== actor.storeId) throw notFound('Order not found');
    if (actor.role !== 'vendor') throw forbidden('Only the delivering store can send the code');
    if (order.status !== 'out_for_delivery') throw conflict('The delivery code can be sent once the order is out for delivery');
    if (order.sent_at && order.resend_in && order.resend_in > 0) {
      throw conflict(`A code was just sent. Try again in ${order.resend_in}s`, { retryAfterSeconds: order.resend_in });
    }

    const code = crypto.randomInt(1000, 10000).toString();
    const stamped = await c.query<{ sent_at: Date; expires_at: Date }>(
      `update orders
          set handover_otp = $2,
              handover_otp_sent_at = now(),
              handover_otp_expires_at = now() + make_interval(mins => $3)
        where id = $1
        returning handover_otp_sent_at as sent_at, handover_otp_expires_at as expires_at`,
      [order.id, code, HANDOVER_OTP_TTL_MINUTES],
    );
    await enqueue(c, 'order.handover_otp', { orderId: order.id });
    const row = stamped.rows[0]!;
    return { orderId: order.id, sentAt: row.sent_at.toISOString(), expiresAt: row.expires_at.toISOString() };
  });
}

async function expireReservationsInTx(batchSize = 50): Promise<number> {
  return withTransaction(async (c) => {
    const due = await c.query<{ id: string }>(
      `select id from orders
        where status = 'pending_payment' and reserved_until < now()
        order by reserved_until
        limit $1
        for update skip locked`,
      [batchSize],
    );
    const mates = due.rows.length
      ? await c.query<{ id: string }>(
          `select id from orders
            where status = 'pending_payment'
              and checkout_id in (select checkout_id from orders where id = any($1::uuid[]) and checkout_id is not null)
              and not (id = any($1::uuid[]))
            for update`,
          [due.rows.map((row) => row.id)],
        )
      : { rows: [] as { id: string }[] };
    const rows = [...due.rows, ...mates.rows];
    for (const { id } of rows) {
      await releaseStock(c, id);
      await c.query(`update orders set status = 'expired', reserved_until = null where id = $1`, [id]);
      await recordStatus(c, id, 'pending_payment', 'expired', { role: 'system', uid: null }, 'Payment not completed in time');
      await enqueue(c, 'order.status_changed', { orderId: id, from: 'pending_payment', to: 'expired' });
    }
    return rows.length;
  });
}

export async function expireReservations(batchSize = 50): Promise<number> {
  const expired = await expireReservationsInTx(batchSize);
  if (expired) void bumpCatalog();
  return expired;
}
