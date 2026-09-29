import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORT = 54329;
const pg = new EmbeddedPostgres({
  databaseDir: path.join(os.tmpdir(), `spaceborn-test-${process.pid}`),
  user: 'spaceborn',
  password: 'spaceborn',
  port: PORT,
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: () => {},
});

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_PORT: String(PORT),
  DB_NAME: 'spaceborn_test',
  DB_USER: 'spaceborn',
  DB_PASSWORD: 'spaceborn',
  DB_SSL: 'disable',
  FIREBASE_PROJECT_ID: 'spaceborn-test',
  AUTH_DEV_BYPASS: 'true',
  RAZORPAY_KEY_ID: '',
  RAZORPAY_KEY_SECRET: '',
  LOG_LEVEL: 'silent',
  UPLOAD_DIR: path.join(os.tmpdir(), `spaceborn-uploads-${process.pid}`),
});

let server: Server;
let base: string;
let db: typeof import('../src/db/pool.js');
let bengaluruStore: string;
let puneStore: string;
let productId: string;

const KORAMANGALA = { latitude: 12.9345, longitude: 77.6268 };
const address = { fullName: 'Asha Rao', phone: '9876543210', line1: '12 Main Road', city: 'Bengaluru', pincode: '560034', ...KORAMANGALA };

type As = string | null;
async function call(as: As, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(as ? { Authorization: `Dev ${as}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

let keyCounter = 0;
const idem = () => ({ 'Idempotency-Key': `test-key-${Date.now()}-${keyCounter++}` });

async function placeOrder(customer: string, quantity = 1, store = bengaluruStore) {
  return call(`${customer}:customer`, 'POST', '/v1/orders', { storeId: store, items: [{ productId, quantity }], address }, idem());
}

beforeAll(async () => {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('spaceborn_test');

  db = await import('../src/db/pool.js');
  await (await import('../src/db/migrate.js')).migrate();
  await (await import('../src/db/seed.js')).seed();

  const stores = await db.pool.query<{ id: string; owner_id: string }>('select id, owner_id from stores');
  bengaluruStore = stores.rows.find((s) => s.owner_id === 'seed-vendor-bengaluru')!.id;
  puneStore = stores.rows.find((s) => s.owner_id === 'seed-vendor-pune')!.id;
  const product = await db.pool.query<{ product_id: string }>(
    'select product_id from inventory where store_id = $1 order by product_id limit 1',
    [bengaluruStore],
  );
  productId = product.rows[0]!.product_id;

  await db.pool.query(`insert into users (id, email, role) values ('root-admin', 'root@test.local', 'admin')`);

  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  server?.close();
  await db?.pool.end();
  await pg.stop();
});

const vendorBlr = () => `seed-vendor-bengaluru:vendor:${bengaluruStore}`;
const vendorPune = () => `seed-vendor-pune:vendor:${puneStore}`;

describe('anonymous access', () => {
  it('can browse the catalog but nothing else', async () => {
    expect((await call(null, 'GET', `/v1/stores/nearby?lat=${KORAMANGALA.latitude}&lng=${KORAMANGALA.longitude}`)).status).toBe(200);
    expect((await call(null, 'GET', `/v1/stores/${bengaluruStore}/products`)).status).toBe(200);
    expect((await call(null, 'GET', '/v1/orders')).status).toBe(401);
    expect((await call(null, 'GET', '/v1/me')).status).toBe(401);
    expect((await call(null, 'GET', '/v1/vendor/inventory')).status).toBe(401);
    expect((await call(null, 'GET', '/v1/admin/overview')).status).toBe(401);
  });

  it('rejects a garbage bearer token', async () => {
    const res = await fetch(`${base}/v1/orders`, { headers: { Authorization: 'Bearer not-a-real-token' } });
    expect(res.status).toBe(401);
  });
});

describe('customer boundaries', () => {
  it('cannot reach vendor or admin endpoints', async () => {
    expect((await call('cust-a:customer', 'GET', '/v1/vendor/inventory')).status).toBe(403);
    expect((await call('cust-a:customer', 'GET', '/v1/vendor/orders')).status).toBe(403);
    expect((await call('cust-a:customer', 'GET', '/v1/admin/stores')).status).toBe(403);
  });

  it('cannot see or cancel another customer’s order', async () => {
    const placed = await placeOrder('cust-a');
    expect(placed.status).toBe(201);
    const orderId = placed.body.order.id;

    expect((await call('cust-b:customer', 'GET', `/v1/orders/${orderId}`)).status).toBe(404);
    expect((await call('cust-b:customer', 'POST', `/v1/orders/${orderId}/cancel`, {})).status).toBe(404);
    expect((await call('cust-b:customer', 'POST', '/v1/payments/mock/confirm', { orderId })).status).toBe(404);
    expect((await call('cust-a:customer', 'GET', `/v1/orders/${orderId}`)).status).toBe(200);
  });

  it('cannot set prices: totals come from store inventory', async () => {
    const placed = await placeOrder('cust-a', 2);
    const { rows } = await db.pool.query('select price from inventory where store_id = $1 and product_id = $2', [bengaluruStore, productId]);
    expect(placed.body.order.itemsTotal).toBe(rows[0].price * 2);
  });
});

describe('forged or stale role claims', () => {
  it('a token claiming admin is refused when the database says otherwise', async () => {
    expect((await call('cust-a:admin', 'GET', '/v1/admin/overview')).status).toBe(403);
  });

  it('a vendor claim pointing at someone else’s store is refused', async () => {
    expect((await call(`cust-a:vendor:${bengaluruStore}`, 'GET', '/v1/vendor/inventory')).status).toBe(403);
    expect((await call(`seed-vendor-pune:vendor:${bengaluruStore}`, 'GET', '/v1/vendor/orders')).status).toBe(403);
  });
});

describe('vendor onboarding and suspension', () => {
  it('pending applicant cannot manage a store until an admin approves', async () => {
    const applied = await call('shop-owner:customer', 'POST', '/v1/vendor/applications', {
      name: 'HSR Components', phone: '9123456780', addressLine: '27th Main, HSR Layout', city: 'Bengaluru',
      pincode: '560102', latitude: 12.9116, longitude: 77.6474,
    });
    expect(applied.status).toBe(201);
    const storeId = applied.body.store.id;
    expect(applied.body.store.status).toBe('pending');

    expect((await call(`shop-owner:vendor:${storeId}`, 'GET', '/v1/vendor/inventory')).status).toBe(403);
    expect((await call('shop-owner:customer', 'POST', `/v1/admin/stores/${storeId}/approve`)).status).toBe(403);

    const approved = await call('root-admin:admin', 'POST', `/v1/admin/stores/${storeId}/approve`);
    expect(approved.status).toBe(200);
    expect((await call(`shop-owner:vendor:${storeId}`, 'GET', '/v1/vendor/inventory')).status).toBe(200);

    const suspended = await call('root-admin:admin', 'POST', `/v1/admin/stores/${storeId}/suspend`, { reason: 'Fake GST documents' });
    expect(suspended.status).toBe(200);
    // Old token still carries the vendor claim, the database check blocks it anyway.
    expect((await call(`shop-owner:vendor:${storeId}`, 'GET', '/v1/vendor/inventory')).status).toBe(403);
  });

  it('a vendor cannot list products above MRP', async () => {
    const { rows } = await db.pool.query('select mrp from products where id = $1', [productId]);
    const res = await call(vendorBlr(), 'PUT', `/v1/vendor/inventory/${productId}`, { price: rows[0].mrp + 1 });
    expect(res.status).toBe(422);
  });
});

describe('order lifecycle across roles', () => {
  it('only the owning store can fulfil, and delivery needs the customer’s code', async () => {
    const placed = await placeOrder('cust-c');
    const orderId = placed.body.order.id;
    const otp = placed.body.order.handoverOtp;

    expect((await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to: 'accepted' })).status).toBe(409);

    const paid = await call('cust-c:customer', 'POST', '/v1/payments/mock/confirm', { orderId });
    expect(paid.body.order.status).toBe('placed');

    expect((await call(vendorPune(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to: 'accepted' })).status).toBe(404);

    const vendorView = await call(vendorBlr(), 'GET', '/v1/vendor/orders?status=placed');
    const seen = vendorView.body.orders.find((o: { id: string }) => o.id === orderId);
    expect(seen).toBeTruthy();
    expect(seen.handoverOtp).toBeUndefined();

    for (const to of ['accepted', 'packing', 'ready_for_pickup', 'out_for_delivery']) {
      const step = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to });
      expect(step.status, to).toBe(200);
    }

    const wrongCode = otp === '1234' ? '4321' : '1234';
    expect((await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to: 'delivered', otp: wrongCode })).status).toBe(403);
    const delivered = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to: 'delivered', otp });
    expect(delivered.body.order.status).toBe('delivered');

    expect((await call('cust-c:customer', 'POST', `/v1/orders/${orderId}/cancel`, {})).status).toBe(409);
  });

  it('cancelling a paid order restocks and queues a refund', async () => {
    const before = await db.pool.query('select stock from inventory where store_id = $1 and product_id = $2', [bengaluruStore, productId]);
    const placed = await placeOrder('cust-d', 3);
    const orderId = placed.body.order.id;
    await call('cust-d:customer', 'POST', '/v1/payments/mock/confirm', { orderId });

    const cancelled = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to: 'cancelled', reason: 'Item damaged' });
    expect(cancelled.body.order.status).toBe('cancelled');

    const after = await db.pool.query('select stock from inventory where store_id = $1 and product_id = $2', [bengaluruStore, productId]);
    expect(after.rows[0].stock).toBe(before.rows[0].stock);
    const payment = await db.pool.query('select status from payments where order_id = $1', [orderId]);
    expect(payment.rows[0].status).toBe('refund_pending');
    const outbox = await db.pool.query(`select 1 from outbox where topic = 'refund.requested' and payload->>'orderId' = $1`, [orderId]);
    expect(outbox.rowCount).toBe(1);
  });

  it('same idempotency key never creates two orders', async () => {
    const headers = idem();
    const body = { storeId: bengaluruStore, items: [{ productId, quantity: 1 }], address };
    const [a, b] = await Promise.all([
      call('cust-e:customer', 'POST', '/v1/orders', body, headers),
      call('cust-e:customer', 'POST', '/v1/orders', body, headers),
    ]);
    expect(a.body.order.id).toBe(b.body.order.id);
  });

  it('concurrent checkouts cannot oversell the last units', async () => {
    await db.pool.query('update inventory set stock = 2 where store_id = $1 and product_id = $2', [bengaluruStore, productId]);
    const results = await Promise.all(['r1', 'r2', 'r3', 'r4'].map((c) => placeOrder(c, 1)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    const { rows } = await db.pool.query('select stock from inventory where store_id = $1 and product_id = $2', [bengaluruStore, productId]);
    expect(rows[0].stock).toBe(0);
  });

  it('customers outside the delivery radius are refused', async () => {
    const res = await call('cust-f:customer', 'POST', '/v1/orders', {
      storeId: puneStore, items: [{ productId, quantity: 1 }], address,
    }, idem());
    expect(res.status).toBe(422);
  });
});

async function upload(as: As, fileName: string, content = 'solid part\nendsolid part\n') {
  const res = await fetch(`${base}/v1/fabrication/uploads`, {
    method: 'POST',
    headers: {
      ...(as ? { Authorization: `Dev ${as}` } : {}),
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(fileName),
    },
    body: content,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

describe('fabrication services', () => {
  let listingId: string;
  const listing = {
    kind: '3d_printing', title: 'FDM printing up to 250mm', materials: ['PLA', 'PETG'],
    maxXmm: 250, maxYmm: 250, maxZmm: 250, startingPrice: 99, turnaroundHours: 6,
  };
  const nearby = () => call(null, 'GET', `/v1/services/nearby?lat=${KORAMANGALA.latitude}&lng=${KORAMANGALA.longitude}&kind=3d_printing`);

  async function submitJob(customer: string, material = 'PLA') {
    const file = await upload(`${customer}:customer`, 'bracket.stl');
    return call(`${customer}:customer`, 'POST', '/v1/fabrication/jobs', {
      listingId, material, quantity: 2, notes: '20% infill', fileIds: [file.body.file.id], address,
    });
  }

  it('a service listing stays hidden until an admin approves it', async () => {
    expect((await call('cust-a:customer', 'POST', '/v1/vendor/services', listing)).status).toBe(403);

    const created = await call(vendorBlr(), 'POST', '/v1/vendor/services', listing);
    expect(created.status).toBe(201);
    expect(created.body.service.status).toBe('pending');
    listingId = created.body.service.id;

    expect((await nearby()).body.services.some((s: { id: string }) => s.id === listingId)).toBe(false);
    expect((await call('cust-a:customer', 'POST', `/v1/admin/services/${listingId}/approve`)).status).toBe(403);
    expect((await call(vendorBlr(), 'POST', `/v1/admin/services/${listingId}/approve`)).status).toBe(403);

    const pending = await submitJob('fab-early');
    expect(pending.status).toBe(422);

    expect((await call('root-admin:admin', 'POST', `/v1/admin/services/${listingId}/approve`)).status).toBe(200);
    expect((await nearby()).body.services.some((s: { id: string }) => s.id === listingId)).toBe(true);
    expect((await call(vendorPune(), 'GET', '/v1/vendor/services')).body.services).toHaveLength(0);
  });

  it('uploads require sign-in and an allowed design file type', async () => {
    expect((await upload(null, 'part.stl')).status).toBe(401);
    expect((await upload('fab-a:customer', 'payload.exe')).status).toBe(422);
    expect((await upload('fab-a:customer', '../../etc/passwd.stl')).body.file.fileName).toBe('passwd.stl');
  });

  it('jobs and design files are private to the customer, the chosen store and admins', async () => {
    const created = await submitJob('fab-a');
    expect(created.status).toBe(201);
    const job = created.body.job;
    const fileUrl = (prefix: string) => `${prefix}/fab-jobs/${job.id}/files/${job.files[0].id}`;

    expect((await call('fab-b:customer', 'GET', `/v1/fabrication/jobs/${job.id}`)).status).toBe(404);
    expect((await call('fab-b:customer', 'GET', `/v1/fabrication/jobs/${job.id}/files/${job.files[0].id}`)).status).toBe(404);
    expect((await call(vendorPune(), 'GET', `/v1/vendor/fab-jobs/${job.id}`)).status).toBe(404);
    expect((await fetch(`${base}${fileUrl('/v1/vendor')}`, { headers: { Authorization: `Dev ${vendorPune()}` } })).status).toBe(404);

    const vendorView = await call(vendorBlr(), 'GET', `/v1/vendor/fab-jobs/${job.id}`);
    expect(vendorView.status).toBe(200);
    expect(vendorView.body.job.handoverOtp).toBeUndefined();
    expect(vendorView.body.job.deliveryAddress.line1).toBeUndefined();

    const download = await fetch(`${base}${fileUrl('/v1/vendor')}`, { headers: { Authorization: `Dev ${vendorBlr()}` } });
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toContain('attachment');
    expect(await download.text()).toContain('solid part');

    const reuse = await call('fab-a:customer', 'POST', '/v1/fabrication/jobs', {
      listingId, material: 'PLA', quantity: 1, fileIds: [job.files[0].id], address,
    });
    expect(reuse.status).toBe(409);
    const stolen = await call('fab-b:customer', 'POST', '/v1/fabrication/jobs', {
      listingId, material: 'PLA', quantity: 1, fileIds: [(await upload('fab-a:customer', 'x.stl')).body.file.id], address,
    });
    expect(stolen.status).toBe(409);
  });

  it('rejects materials the service does not offer', async () => {
    expect((await submitJob('fab-c', 'Titanium')).status).toBe(422);
  });

  it('quote, pay and deliver with the customer’s code', async () => {
    const job = (await submitJob('fab-d')).body.job;
    const otp = job.handoverOtp;

    expect((await call('fab-d:customer', 'POST', `/v1/fabrication/jobs/${job.id}/accept`)).status).toBe(409);
    expect((await call('fab-d:customer', 'POST', `/v1/vendor/fab-jobs/${job.id}/quote`, { amount: 300, readyInHours: 4 })).status).toBe(403);
    expect((await call(vendorPune(), 'POST', `/v1/vendor/fab-jobs/${job.id}/quote`, { amount: 300, readyInHours: 4 })).status).toBe(404);

    const quoted = await call(vendorBlr(), 'POST', `/v1/vendor/fab-jobs/${job.id}/quote`, { amount: 300, readyInHours: 4 });
    expect(quoted.body.job.status).toBe('quoted');

    expect((await call('fab-x:customer', 'POST', `/v1/fabrication/jobs/${job.id}/accept`)).status).toBe(404);
    const accepted = await call('fab-d:customer', 'POST', `/v1/fabrication/jobs/${job.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.job.grandTotal).toBe(300 + accepted.body.job.deliveryFee + accepted.body.job.platformFee);
    expect(accepted.body.payment.amountPaise).toBe(Math.round(accepted.body.job.grandTotal * 100));

    expect((await call(vendorBlr(), 'POST', `/v1/vendor/fab-jobs/${job.id}/quote`, { amount: 1, readyInHours: 1 })).status).toBe(409);
    expect((await call('fab-x:customer', 'POST', `/v1/fabrication/jobs/${job.id}/mock-pay`)).status).toBe(404);
    const paid = await call('fab-d:customer', 'POST', `/v1/fabrication/jobs/${job.id}/mock-pay`);
    expect(paid.body.job.status).toBe('in_production');

    const vendorView = await call(vendorBlr(), 'GET', `/v1/vendor/fab-jobs/${job.id}`);
    expect(vendorView.body.job.deliveryAddress.line1).toBe(address.line1);

    for (const to of ['ready', 'out_for_delivery']) {
      expect((await call(vendorBlr(), 'POST', `/v1/vendor/fab-jobs/${job.id}/transition`, { to })).status, to).toBe(200);
    }
    const wrongCode = otp === '1234' ? '4321' : '1234';
    expect((await call(vendorBlr(), 'POST', `/v1/vendor/fab-jobs/${job.id}/transition`, { to: 'delivered', otp: wrongCode })).status).toBe(403);
    const delivered = await call(vendorBlr(), 'POST', `/v1/vendor/fab-jobs/${job.id}/transition`, { to: 'delivered', otp });
    expect(delivered.body.job.status).toBe('delivered');
  });

  it('cancelling a paid job queues a refund; customers cannot cancel once production starts', async () => {
    const job = (await submitJob('fab-e')).body.job;
    await call(vendorBlr(), 'POST', `/v1/vendor/fab-jobs/${job.id}/quote`, { amount: 800, readyInHours: 8 });
    await call('fab-e:customer', 'POST', `/v1/fabrication/jobs/${job.id}/accept`);
    await call('fab-e:customer', 'POST', `/v1/fabrication/jobs/${job.id}/mock-pay`);

    expect((await call('fab-e:customer', 'POST', `/v1/fabrication/jobs/${job.id}/cancel`, {})).status).toBe(409);
    expect((await call('root-admin:admin', 'POST', `/v1/admin/fab-jobs/${job.id}/cancel`, {})).status).toBe(400);
    const cancelled = await call('root-admin:admin', 'POST', `/v1/admin/fab-jobs/${job.id}/cancel`, { reason: 'Printer failure' });
    expect(cancelled.body.job.status).toBe('cancelled');

    const payment = await db.pool.query('select status from payments where fab_job_id = $1', [job.id]);
    expect(payment.rows[0].status).toBe('refund_pending');
  });

  it('suspending a listing stops new jobs; editing sends it back to review', async () => {
    expect((await call('root-admin:admin', 'POST', `/v1/admin/services/${listingId}/suspend`, { reason: 'Quality complaints' })).status).toBe(200);
    expect((await submitJob('fab-f')).status).toBe(422);
    expect((await call(vendorBlr(), 'POST', '/v1/vendor/services', listing)).status).toBe(409);

    await call('root-admin:admin', 'POST', `/v1/admin/services/${listingId}/approve`);
    const edited = await call(vendorBlr(), 'POST', '/v1/vendor/services', { ...listing, materials: ['PLA', 'TPU'] });
    expect(edited.body.service.status).toBe('pending');
    expect((await nearby()).body.services.some((s: { id: string }) => s.id === listingId)).toBe(false);
  });
});
