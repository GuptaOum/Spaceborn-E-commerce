import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb } from './testdb.js';

// What happens when a checkout, a shop or a refund goes wrong halfway through.

let testDb: Awaited<ReturnType<typeof startTestDb>>;
let server: Server;
let base: string;
let db: typeof import('../src/db/pool.js');
let kanpurStore: string;
let secondStore: string;
let productA: string;
let productB: string;

const KANPUR = { latitude: 26.4534, longitude: 80.3349 };
const address = { fullName: 'Ravi Verma', phone: '9876543210', line1: '5 Civil Lines', city: 'Kanpur', pincode: '208001', ...KANPUR };
const ADMIN = 'root-admin:admin';
const vendorTwo = () => `kanpur-two:vendor:${secondStore}`;
const vendorKanpur = () => `seed-vendor-kanpur:vendor:${kanpurStore}`;

async function call(as: string | null, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { ...(as ? { Authorization: `Dev ${as}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

let keyCounter = 0;
const newKey = () => `recovery-key-${Date.now()}-${keyCounter++}`;

const order = (customer: string, items: { productId: string; quantity: number }[], key = newKey(), to = address) =>
  call(`${customer}:customer`, 'POST', '/v1/orders', { items, address: to }, { 'Idempotency-Key': key });

const pay = (customer: string, orderId: string) => call(`${customer}:customer`, 'POST', '/v1/payments/mock/confirm', { orderId });

async function checkoutOrders(orderId: string) {
  const { rows } = await db.pool.query<{ id: string; status: string; store_id: string }>(
    `select id, status, store_id from orders where checkout_id = (select checkout_id from orders where id = $1) order by id`,
    [orderId],
  );
  return rows;
}

async function upload(as: string, fileName: string) {
  const res = await fetch(`${base}/v1/fabrication/uploads`, {
    method: 'POST',
    headers: { Authorization: `Dev ${as}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(fileName) },
    body: 'solid part\nendsolid part\n',
  });
  return (await res.json()) as { file: { id: string } };
}

let listingId: string;

// A paid print job at the second store, already in production.
async function paidJob(customer: string) {
  const file = await upload(`${customer}:customer`, 'bracket.stl');
  const created = await call(`${customer}:customer`, 'POST', '/v1/fabrication/jobs', {
    listingId, material: 'PLA', quantity: 1, fileIds: [file.file.id], address,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const jobId: string = created.body.job.id;
  await call(vendorTwo(), 'POST', `/v1/vendor/fab-jobs/${jobId}/quote`, { amount: 250, readyInHours: 4 });
  await call(`${customer}:customer`, 'POST', `/v1/fabrication/jobs/${jobId}/accept`);
  const paid = await call(`${customer}:customer`, 'POST', `/v1/fabrication/jobs/${jobId}/mock-pay`);
  expect(paid.body.job.status).toBe('in_production');
  return jobId;
}

beforeAll(async () => {
  testDb = await startTestDb('spaceborn_recovery', 54333, 'recovery');
  db = await import('../src/db/pool.js');
  await (await import('../src/db/migrate.js')).migrate();
  await (await import('../src/db/seed.js')).seed();

  const stores = await db.pool.query<{ id: string; owner_id: string }>('select id, owner_id from stores');
  kanpurStore = stores.rows.find((s) => s.owner_id === 'seed-vendor-kanpur')!.id;
  const products = await db.pool.query<{ product_id: string }>(
    'select product_id from inventory where store_id = $1 order by product_id limit 2',
    [kanpurStore],
  );
  productA = products.rows[0]!.product_id;
  productB = products.rows[1]!.product_id;
  await db.pool.query('update inventory set stock = 50 where store_id = $1', [kanpurStore]);

  // A closer shop that only stocks A, so a cart of A and B splits into two deliveries.
  await db.pool.query(`insert into users (id, email, role) values ('kanpur-two', 'two@test.local', 'vendor')`);
  const second = await db.pool.query<{ id: string }>(
    `insert into stores (owner_id, name, phone, address_line, city, pincode, latitude, longitude, status, is_online, delivery_radius_km)
     values ('kanpur-two', 'Swaroop Nagar Electronics', '9876500000', 'Swaroop Nagar', 'Kanpur', '208002', $1, $2, 'approved', true, 8)
     returning id`,
    [KANPUR.latitude - 0.001, KANPUR.longitude - 0.001],
  );
  secondStore = second.rows[0]!.id;
  await db.pool.query('insert into inventory (store_id, product_id, price, stock) values ($1, $2, 120, 100)', [secondStore, productA]);
  await db.pool.query(`insert into admin_members (email, is_owner, note) values ('root-admin@dev.local', true, 'test owner')`);

  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const listing = await call(vendorTwo(), 'POST', '/v1/vendor/services', {
    kind: '3d_printing', title: 'FDM printing', materials: ['PLA'], maxXmm: 200, maxYmm: 200, maxZmm: 200, startingPrice: 99, turnaroundHours: 6,
  });
  expect(listing.status, JSON.stringify(listing.body)).toBe(201);
  listingId = listing.body.service.id;
  expect((await call(ADMIN, 'POST', `/v1/admin/services/${listingId}/approve`)).status).toBe(200);
}, 180_000);

afterAll(async () => {
  server?.close();
  await db?.pool.end();
  await testDb?.stop();
}, 60_000);

describe('master catalog', () => {
  it('loads the whole catalog in one admin request', async () => {
    const all = await call(ADMIN, 'GET', '/v1/admin/products?limit=500');
    expect(all.status).toBe(200);
    expect(all.body.products.length).toBeGreaterThan(0);
    expect((await call(ADMIN, 'GET', '/v1/admin/products?limit=501')).status).toBe(400);
    expect((await call('rc-shopper:customer', 'GET', '/v1/admin/products?limit=500')).status).toBe(403);
  });
});

describe('idempotency key reuse', () => {
  it('replays the same cart, refuses a changed cart or address', async () => {
    const key = newKey();
    const first = await order('rc-idem', [{ productId: productA, quantity: 1 }], key);
    expect(first.status).toBe(201);
    const again = await order('rc-idem', [{ productId: productA, quantity: 1 }], key);
    expect(again.body.order.id).toBe(first.body.order.id);

    const moreItems = await order('rc-idem', [{ productId: productA, quantity: 2 }], key);
    expect(moreItems.status).toBe(409);
    expect(moreItems.body.error.details.code).toBe('idempotency_mismatch');

    const otherAddress = await order('rc-idem', [{ productId: productA, quantity: 1 }], key, { ...address, line1: '9 Mall Road' });
    expect(otherAddress.status).toBe(409);
    expect(otherAddress.body.error.details.code).toBe('idempotency_mismatch');

    // Nothing new was created, and a fresh key places the changed cart normally.
    const { rows } = await db.pool.query(`select count(*)::int as n from orders where customer_id = 'rc-idem'`);
    expect(rows[0].n).toBe(1);
    expect((await order('rc-idem', [{ productId: productA, quantity: 2 }])).status).toBe(201);
  });

  it('compares the whole split checkout, not just its first delivery', async () => {
    const key = newKey();
    const items = [{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }];
    const first = await order('rc-idem-split', items, key);
    expect(first.status).toBe(201);
    expect(await checkoutOrders(first.body.order.id)).toHaveLength(2);
    expect((await order('rc-idem-split', items, key)).body.order.id).toBe(first.body.order.id);
    const dropB = await order('rc-idem-split', [{ productId: productA, quantity: 1 }], key);
    expect(dropB.body.error.details.code).toBe('idempotency_mismatch');
  });
});

describe('split checkout before payment', () => {
  const items = () => [{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }];

  it('cancelling one delivery cancels the whole unpaid checkout and releases its stock', async () => {
    const before = await db.pool.query<{ stock: number }>('select stock from inventory where store_id = $1 and product_id = $2', [kanpurStore, productB]);
    const placed = await order('rc-split', items());
    const parts = await checkoutOrders(placed.body.order.id);
    expect(parts).toHaveLength(2);

    const cancelled = await call('rc-split:customer', 'POST', `/v1/orders/${parts[1]!.id}/cancel`, {});
    expect(cancelled.status).toBe(200);
    expect((await checkoutOrders(placed.body.order.id)).map((o) => o.status)).toEqual(['cancelled', 'cancelled']);
    const after = await db.pool.query<{ stock: number }>('select stock from inventory where store_id = $1 and product_id = $2', [kanpurStore, productB]);
    expect(after.rows[0]!.stock).toBe(before.rows[0]!.stock);
  });

  it('refuses to resume payment once any delivery of the checkout was cancelled', async () => {
    const placed = await order('rc-split-pay', items());
    const parts = await checkoutOrders(placed.body.order.id);
    const resume = await call('rc-split-pay:customer', 'POST', `/v1/orders/${parts[0]!.id}/pay`, {});
    expect(resume.status).toBe(200);

    // Support cancels one part (only that one) while the customer is in Razorpay.
    const adminCancel = await call(ADMIN, 'POST', `/v1/admin/orders/${parts[1]!.id}/cancel`, { reason: 'Shop called, out of stock' });
    expect(adminCancel.status).toBe(200);
    const broken = await call('rc-split-pay:customer', 'POST', `/v1/orders/${parts[0]!.id}/pay`, {});
    expect(broken.status).toBe(409);
    expect(broken.body.error.details.code).toBe('checkout_broken');
  });

  it('a single paid order is still cancelled on its own', async () => {
    const placed = await order('rc-single', [{ productId: productA, quantity: 1 }]);
    await pay('rc-single', placed.body.order.id);
    const cancelled = await call('rc-single:customer', 'POST', `/v1/orders/${placed.body.order.id}/cancel`, {});
    expect(cancelled.body.order.status).toBe('cancelled');
  });
});

let unacceptedOrderId: string;

describe('shop never accepts a paid order', () => {
  it('cancels and refunds it after the accept window and takes the shop offline', async () => {
    const placed = await order('rc-wait', [{ productId: productA, quantity: 1 }]);
    unacceptedOrderId = placed.body.order.id;
    expect((await pay('rc-wait', unacceptedOrderId)).body.order.status).toBe('placed');
    expect((await db.pool.query('select store_id from orders where id = $1', [unacceptedOrderId])).rows[0].store_id).toBe(secondStore);

    const { cancelUnaccepted } = await import('../src/orders/service.js');
    // Still inside the window: nothing happens.
    await cancelUnaccepted();
    expect((await call('rc-wait:customer', 'GET', `/v1/orders/${unacceptedOrderId}`)).body.order.status).toBe('placed');

    await db.pool.query(`update orders set placed_at = now() - interval '1 hour' where id = $1`, [unacceptedOrderId]);
    expect(await cancelUnaccepted()).toBeGreaterThanOrEqual(1);

    const view = await call('rc-wait:customer', 'GET', `/v1/orders/${unacceptedOrderId}`);
    expect(view.body.order.status).toBe('cancelled');
    expect(view.body.order.cancelReason).toContain('refunded');
    expect(view.body.order.paymentStatus).toBe('refund_pending');
    const store = await db.pool.query('select is_online from stores where id = $1', [secondStore]);
    expect(store.rows[0].is_online).toBe(false);
    await db.pool.query('update stores set is_online = true where id = $1', [secondStore]);
  });

  it('leaves an order the shop accepted in time alone', async () => {
    const placed = await order('rc-ok', [{ productId: productA, quantity: 1 }]);
    await pay('rc-ok', placed.body.order.id);
    expect((await call(vendorTwo(), 'POST', `/v1/vendor/orders/${placed.body.order.id}/transition`, { to: 'accepted' })).status).toBe(200);
    await db.pool.query(`update orders set placed_at = now() - interval '1 hour' where id = $1`, [placed.body.order.id]);
    const { cancelUnaccepted } = await import('../src/orders/service.js');
    await cancelUnaccepted();
    expect((await call('rc-ok:customer', 'GET', `/v1/orders/${placed.body.order.id}`)).body.order.status).toBe('accepted');
    await call(vendorTwo(), 'POST', `/v1/vendor/orders/${placed.body.order.id}/transition`, { to: 'cancelled', reason: 'Test cleanup' });
  });
});

describe('print job delivery code', () => {
  it('can be re-sent at the door once it expires', async () => {
    const jobId = await paidJob('rc-fab');
    for (const to of ['ready', 'out_for_delivery']) {
      expect((await call(vendorTwo(), 'POST', `/v1/vendor/fab-jobs/${jobId}/transition`, { to })).status, to).toBe(200);
    }
    // Only the delivering shop can send it, and not twice in a row.
    expect((await call(vendorKanpur(), 'POST', `/v1/vendor/fab-jobs/${jobId}/handover-otp`, {})).status).toBe(404);
    expect((await call(vendorTwo(), 'POST', `/v1/vendor/fab-jobs/${jobId}/handover-otp`, {})).status).toBe(409);

    // The ride took longer than the code lives.
    await db.pool.query(
      `update fab_jobs set handover_otp_expires_at = now() - interval '1 minute', handover_otp_sent_at = now() - interval '11 minutes' where id = $1`,
      [jobId],
    );
    const expired = await db.pool.query<{ handover_otp: string }>('select handover_otp from fab_jobs where id = $1', [jobId]);
    expect((await call(vendorTwo(), 'POST', `/v1/vendor/fab-jobs/${jobId}/transition`, { to: 'delivered', otp: expired.rows[0]!.handover_otp })).status).toBe(409);

    const sent = await call(vendorTwo(), 'POST', `/v1/vendor/fab-jobs/${jobId}/handover-otp`, {});
    expect(sent.status).toBe(200);
    expect(new Date(sent.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const customer = await call('rc-fab:customer', 'GET', `/v1/fabrication/jobs/${jobId}`);
    const code: string = customer.body.job.handoverOtp;
    expect(code).toMatch(/^\d{4}$/);
    const vendorView = await call(vendorTwo(), 'GET', `/v1/vendor/fab-jobs/${jobId}`);
    expect(vendorView.body.job.handoverOtp).toBeUndefined();

    const delivered = await call(vendorTwo(), 'POST', `/v1/vendor/fab-jobs/${jobId}/transition`, { to: 'delivered', otp: code });
    expect(delivered.body.job.status).toBe('delivered');
    expect((await call(vendorTwo(), 'POST', `/v1/vendor/fab-jobs/${jobId}/handover-otp`, {})).status).toBe(409);
  });
});

describe('refunds that fail', () => {
  const failIt = () =>
    db.pool.query(
      `update outbox set failed_at = now(), attempts = 8, last_error = 'BAD_REQUEST_ERROR: payment already refunded'
        where topic = 'refund.requested' and payload->>'orderId' = $1`,
      [unacceptedOrderId],
    );

  it('show up for support, can be retried, and can be recorded as refunded by hand', async () => {
    await failIt();
    expect((await call('rc-shopper:customer', 'GET', '/v1/admin/refunds')).status).toBe(403);
    const list = await call(ADMIN, 'GET', '/v1/admin/refunds');
    expect(list.status).toBe(200);
    const ours = list.body.refunds.find((r: { lastError: string | null }) => r.lastError?.includes('already refunded'));
    expect(ours.orderNumber).toBeGreaterThan(0);
    expect(ours.customerName).toBe(address.fullName);
    expect(ours.failedAt).toBeTruthy();
    expect(ours.amountPaise).toBeGreaterThan(0);

    expect((await call(ADMIN, 'POST', `/v1/admin/refunds/${ours.id}/retry`, {})).status).toBe(200);
    const retried = await db.pool.query('select attempts, failed_at from outbox where id = $1', [ours.id]);
    expect(retried.rows[0]).toEqual({ attempts: 0, failed_at: null });

    await failIt();
    expect((await call(ADMIN, 'POST', `/v1/admin/refunds/${ours.id}/settle`, { reference: 'x' })).status).toBe(400);
    const settled = await call(ADMIN, 'POST', `/v1/admin/refunds/${ours.id}/settle`, { reference: 'UTR998877' });
    expect(settled.status).toBe(200);
    expect(settled.body.amountPaise).toBe(ours.amountPaise);

    const payment = await db.pool.query(
      `select p.status, r.provider_refund_id from payments p join payment_refunds r on r.payment_id = p.id
        where r.reference = $1`,
      [unacceptedOrderId],
    );
    expect(payment.rows[0]).toEqual({ status: 'refunded', provider_refund_id: 'manual:UTR998877' });
    expect((await call(ADMIN, 'GET', '/v1/admin/refunds')).body.refunds.some((r: { id: number }) => r.id === ours.id)).toBe(false);
    expect((await call(ADMIN, 'POST', `/v1/admin/refunds/${ours.id}/settle`, { reference: 'UTR998877' })).status).toBe(404);
  });
});

describe('suspending a shop with open work', () => {
  it('cancels and refunds what has not left, keeps what is on the road for support to close', async () => {
    const ids: string[] = [];
    for (const customer of ['rc-s1', 'rc-s2', 'rc-s3']) {
      const placed = await order(customer, [{ productId: productA, quantity: 1 }]);
      await pay(customer, placed.body.order.id);
      ids.push(placed.body.order.id);
    }
    const [waiting, packing, onRoad] = ids as [string, string, string];
    for (const to of ['accepted', 'packing']) {
      await call(vendorTwo(), 'POST', `/v1/vendor/orders/${packing}/transition`, { to });
    }
    for (const to of ['accepted', 'packing', 'ready_for_pickup', 'out_for_delivery']) {
      expect((await call(vendorTwo(), 'POST', `/v1/vendor/orders/${onRoad}/transition`, { to })).status, to).toBe(200);
    }
    const jobId = await paidJob('rc-s4');

    const suspended = await call(ADMIN, 'POST', `/v1/admin/stores/${secondStore}/suspend`, { reason: 'Repeated no-shows' });
    expect(suspended.status, JSON.stringify(suspended.body)).toBe(200);
    expect(suspended.body).toMatchObject({ cancelledOrders: 2, cancelledJobs: 1, onTheRoad: 1 });

    for (const [id, customer] of [[waiting, 'rc-s1'], [packing, 'rc-s2']] as const) {
      const view = await call(`${customer}:customer`, 'GET', `/v1/orders/${id}`);
      expect(view.body.order.status).toBe('cancelled');
      expect(view.body.order.paymentStatus).toBe('refund_pending');
    }
    const job = await db.pool.query('select j.status, p.status as payment from fab_jobs j join payments p on p.fab_job_id = j.id where j.id = $1', [jobId]);
    expect(job.rows[0]).toEqual({ status: 'cancelled', payment: 'refund_pending' });

    // The suspended owner can no longer close it; support can, with a reason on record.
    expect((await call(vendorTwo(), 'POST', `/v1/vendor/orders/${onRoad}/handover-otp`, {})).status).toBe(403);
    expect((await call(ADMIN, 'POST', `/v1/admin/orders/${onRoad}/deliver`, {})).status).toBe(400);
    const delivered = await call(ADMIN, 'POST', `/v1/admin/orders/${onRoad}/deliver`, { reason: 'Customer confirmed on call' });
    expect(delivered.status).toBe(200);
    expect(delivered.body.order.status).toBe('delivered');
    const audit = await db.pool.query(`select 1 from admin_audit_log where action = 'order.deliver' and target_id = $1`, [onRoad]);
    expect(audit.rowCount).toBe(1);

    // Customers and vendors still cannot skip the code.
    expect((await call('rc-s3:customer', 'POST', `/v1/admin/orders/${onRoad}/deliver`, { reason: 'trust me' })).status).toBe(403);
  });
});
