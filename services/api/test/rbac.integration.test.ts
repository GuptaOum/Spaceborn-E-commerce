import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb } from './testdb.js';

let testDb: Awaited<ReturnType<typeof startTestDb>>;
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

// The server assigns the store from the delivery coordinates; clients cannot name one.
async function placeOrder(customer: string, quantity = 1) {
  return call(`${customer}:customer`, 'POST', '/v1/orders', { items: [{ productId, quantity }], address }, idem());
}

beforeAll(async () => {
  testDb = await startTestDb('spaceborn_test', 54329, 'rbac');

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

  // Admin access comes from the team table, keyed by email. Dev-bypass users are `${uid}@dev.local`.
  await db.pool.query(`insert into admin_members (email, is_owner, note) values ('root-admin@dev.local', true, 'test owner')`);

  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  server?.close();
  await db?.pool.end();
  await testDb?.stop();
}, 60_000);

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

  it('unlisting, relisting and stock adjustments work without resending the price', async () => {
    const before = await db.pool.query<{ price: string; stock: number }>(
      'select price, stock from inventory where store_id = $1 and product_id = $2',
      [bengaluruStore, productId],
    );
    const price = Number(before.rows[0]!.price);

    const unlisted = await call(vendorBlr(), 'PUT', `/v1/vendor/inventory/${productId}`, { isListed: false });
    expect(unlisted.status).toBe(200);
    expect(unlisted.body.item).toMatchObject({ isListed: false, price });

    const bumped = await call(vendorBlr(), 'PUT', `/v1/vendor/inventory/${productId}`, { stockDelta: 3, isListed: true });
    expect(bumped.status).toBe(200);
    expect(bumped.body.item).toMatchObject({ isListed: true, price, stock: before.rows[0]!.stock + 3 });

    // A product the store has never stocked still needs both price and stock.
    const { rows: other } = await db.pool.query<{ id: string }>(
      'select id from products where is_active and id not in (select product_id from inventory where store_id = $1) limit 1',
      [bengaluruStore],
    );
    if (other[0]) {
      const partial = await call(vendorBlr(), 'PUT', `/v1/vendor/inventory/${other[0].id}`, { isListed: true });
      expect(partial.status).toBe(422);
      expect(partial.body.error.code).toBe('price_and_stock_required');
    }
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
    // Earlier cases in this file draw the seeded stock down, and this one only cares that whatever
    // was reserved comes back, so give it a known quantity to work with.
    await db.pool.query('update inventory set stock = 12 where store_id = $1 and product_id = $2', [bengaluruStore, productId]);
    const before = await db.pool.query('select stock from inventory where store_id = $1 and product_id = $2', [bengaluruStore, productId]);
    const placed = await placeOrder('cust-d', 3);
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
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
    const body = { items: [{ productId, quantity: 1 }], address };
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

  it('customers outside every delivery radius are refused', async () => {
    const res = await call('cust-f:customer', 'POST', '/v1/orders', {
      items: [{ productId, quantity: 1 }],
      address: { ...address, latitude: 22.0, longitude: 76.0, city: 'Khandwa', pincode: '450001' },
    }, idem());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('unserviceable');
  });

  it('a client cannot pin the store that fulfils its order', async () => {
    // The oversell test above drains this row.
    await db.pool.query('update inventory set stock = 5 where store_id = $1 and product_id = $2', [bengaluruStore, productId]);
    // storeId is not part of the schema, so naming Pune must not route the order there.
    const res = await call('cust-g:customer', 'POST', '/v1/orders', {
      storeId: puneStore, items: [{ productId, quantity: 1 }], address,
    }, idem());
    expect(res.status).toBe(201);
    expect(res.body.order.storeId).toBe(bengaluruStore);
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
    const kanpur = await call(null, 'GET', '/v1/services/nearby?lat=26.4499&lng=80.3319&kind=3d_printing');
    expect(kanpur.body.services.some((s: { id: string }) => s.id === listingId)).toBe(false);
    expect((await call(vendorPune(), 'GET', '/v1/vendor/services')).body.services).toHaveLength(0);
  });

  it('an approved service stays visible inside the delivery radius when the store is offline for instant orders', async () => {
    await db.pool.query('update stores set is_online = false where id = $1', [bengaluruStore]);
    try {
      expect((await nearby()).body.services.some((s: { id: string }) => s.id === listingId)).toBe(true);
    } finally {
      await db.pool.query('update stores set is_online = true where id = $1', [bengaluruStore]);
    }
  });

  it('a customer just outside the radius is told which maker is nearby and how far it reaches', async () => {
    // Whitefield: ~12 km from Koramangala, outside the seeded 5 km radius but inside the search window.
    const res = await call(null, 'GET', '/v1/services/nearby?lat=12.9698&lng=77.7500&kind=3d_printing');
    expect(res.status).toBe(200);
    expect(res.body.services.some((s: { id: string }) => s.id === listingId)).toBe(false);
    const near = res.body.outOfRange.find((s: { id: string }) => s.id === listingId);
    expect(near).toBeTruthy();
    expect(near.distanceKm).toBeGreaterThan(near.deliveryRadiusKm);
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

describe('vendor product submissions', () => {
  const KANPUR = { latitude: 26.4499, longitude: 80.3319 };

  const photo = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 60 } } }).png().toBuffer();

  async function uploadImage(as: As, body?: Buffer, fileName = 'photo.png') {
    const res = await fetch(`${base}/v1/vendor/product-images`, {
      method: 'POST',
      headers: {
        ...(as ? { Authorization: `Dev ${as}` } : {}),
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(fileName),
      },
      body: new Uint8Array(body ?? (await photo(240, 180))),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  it('phone-sized photos are downscaled and junk files are rejected', async () => {
    // 12 MP photo, larger than Bedrock's pixel limit.
    const big = await uploadImage(vendorBlr(), await photo(4000, 3000), 'IMG_2041.PNG');
    expect(big.status).toBe(201);
    const created = await call(vendorBlr(), 'POST', '/v1/vendor/product-submissions', submission(big.body.imageKey, 'Large Photo Regression Item'));
    expect(created.status).toBe(201);
    const stored = await fetch(`${base}/v1/vendor/product-submissions/${created.body.submission.id}/image`, {
      headers: { Authorization: `Dev ${vendorBlr()}` },
    });
    expect(stored.status).toBe(200);
    const meta = await sharp(Buffer.from(await stored.arrayBuffer())).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1280);

    const junk = await uploadImage(vendorBlr(), Buffer.alloc(64, 7));
    expect(junk.status).toBe(422);
    expect(junk.body.error.code).toBe('image_unreadable');
  });

  function submission(imageKey: string, name: string) {
    return {
      name,
      description: 'Sold by this shop only. 30V bench supply for local makers.',
      categoryId: 'dev-boards',
      mrp: 999,
      price: 800,
      stock: 4,
      imageKey,
    };
  }

  it('a new product stays invisible until an admin approves it, and then only near that store', async () => {
    expect((await uploadImage('cust-a:customer')).status).toBe(403);
    const image = await uploadImage(vendorBlr());
    expect(image.status).toBe(201);
    const created = await call(vendorBlr(), 'POST', '/v1/vendor/product-submissions', submission(image.body.imageKey, 'Bengaluru Bench Supply 30V'));
    expect(created.status).toBe(201);
    expect(created.body.submission.status).toBe('pending');
    const id = created.body.submission.id;

    expect((await call(vendorPune(), 'GET', '/v1/vendor/product-submissions')).body.submissions.some((s: { id: string }) => s.id === id)).toBe(false);
    expect((await call(vendorPune(), 'DELETE', `/v1/vendor/product-submissions/${id}`)).status).toBe(404);
    expect((await call('cust-a:customer', 'POST', `/v1/admin/product-submissions/${id}/approve`, {})).status).toBe(403);

    const hidden = await call(null, 'GET', `/v1/catalog/products?lat=${KORAMANGALA.latitude}&lng=${KORAMANGALA.longitude}&q=${encodeURIComponent('Bengaluru Bench Supply')}&limit=50`);
    expect(hidden.body.products.some((p: { name: string }) => p.name.includes('Bench Supply'))).toBe(false);

    const review = await call('root-admin:admin', 'GET', `/v1/admin/product-submissions/${id}`);
    expect(review.status).toBe(200);
    expect(Array.isArray(review.body.similar)).toBe(true);

    const approved = await call('root-admin:admin', 'POST', `/v1/admin/product-submissions/${id}/approve`, {});
    expect(approved.status).toBe(200);

    const near = await call(null, 'GET', `/v1/catalog/products?lat=${KORAMANGALA.latitude}&lng=${KORAMANGALA.longitude}&q=${encodeURIComponent('Bengaluru Bench Supply')}&limit=50`);
    const found = near.body.products.find((p: { name: string }) => p.name.includes('Bench Supply'));
    expect(found?.imageUrl).toContain('/image');
    const img = await fetch(`${base}${found.imageUrl}`);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toContain('image/jpeg');

    const far = await call(null, 'GET', `/v1/catalog/products?lat=${KANPUR.latitude}&lng=${KANPUR.longitude}&q=${encodeURIComponent('Bengaluru Bench Supply')}&limit=50`);
    expect(far.body.products.some((p: { name: string }) => p.name.includes('Bench Supply'))).toBe(false);
  });

  it('flags a copied title and can attach the vendor stock to the existing product', async () => {
    const product = await call('root-admin:admin', 'POST', '/v1/admin/products', {
      sku: 'SB-DUP-TEST', name: 'Duplicate Detector Widget 9000', categoryId: 'dev-boards', mrp: 500, description: 'Reference item',
    });
    expect(product.status).toBe(201);
    const image = await uploadImage(vendorBlr());
    const created = await call(vendorBlr(), 'POST', '/v1/vendor/product-submissions', submission(image.body.imageKey, 'Duplicate Detector Widget 9000'));
    expect(created.status).toBe(201);
    const review = await call('root-admin:admin', 'GET', `/v1/admin/product-submissions/${created.body.submission.id}`);
    const hit = review.body.similar.find((s: { id: string; likelyDuplicate: boolean }) => s.id === product.body.product.id);
    expect(hit?.likelyDuplicate).toBe(true);

    const merged = await call('root-admin:admin', 'POST', `/v1/admin/product-submissions/${created.body.submission.id}/approve`, {
      mergeIntoProductId: product.body.product.id,
    });
    expect(merged.status).toBe(200);
    expect(merged.body.submission.productId).toBe(product.body.product.id);
  });

  it('refuses a photo uploaded by a different store', async () => {
    const image = await uploadImage(vendorBlr());
    const stolen = await call(vendorPune(), 'POST', '/v1/vendor/product-submissions', submission(image.body.imageKey, 'Stolen Photo Listing Item'));
    expect(stolen.status).toBe(422);
  });
});

describe('customer search', () => {
  const near = `lat=${KORAMANGALA.latitude}&lng=${KORAMANGALA.longitude}`;

  it('ranks the exact product first, finds nothing for nonsense, and stays inside the delivery area', async () => {
    const { rows } = await db.pool.query<{ name: string }>('select name from products where id = $1', [productId]);
    const name = rows[0]!.name;

    const hit = await call(null, 'GET', `/v1/catalog/products?${near}&q=${encodeURIComponent(name)}`);
    expect(hit.status).toBe(200);
    expect(hit.body.searchMode).toBe('hybrid');
    expect(hit.body.products[0].id).toBe(productId);
    expect(hit.body.products.every((p: { storeCity: string }) => p.storeCity === 'Bengaluru')).toBe(true);

    const miss = await call(null, 'GET', `/v1/catalog/products?${near}&q=zzqxvwk`);
    expect(miss.status).toBe(200);
    expect(miss.body.products).toEqual([]);

    const browse = await call(null, 'GET', `/v1/catalog/products?${near}`);
    expect(browse.body.searchMode).toBeNull();
    expect(browse.body.products.length).toBeGreaterThan(0);
  });

  it('every seeded product has a search vector', async () => {
    const { rows } = await db.pool.query<{ n: number }>(
      'select count(*)::int as n from products where is_active and text_embedding is null',
    );
    expect(rows[0]!.n).toBe(0);
  });
});

describe('admin team and regions', () => {
  const kanpurAdmin = 'kanpur-admin:customer'; // the token says customer; membership alone grants admin access

  it('only owners manage the team, and a new member is recognised before ever signing in', async () => {
    expect((await call('cust-a:customer', 'POST', '/v1/admin/team', { email: 'x@dev.local' })).status).toBe(403);
    expect((await call(kanpurAdmin, 'GET', '/v1/admin/overview')).status).toBe(403);

    const added = await call('root-admin:admin', 'POST', '/v1/admin/team', {
      email: 'Kanpur-Admin@dev.local', displayName: 'Kanpur Ops', regions: ['Kanpur'],
    });
    expect(added.status).toBe(201);
    expect(added.body.member.email).toBe('kanpur-admin@dev.local');
    expect(added.body.member.regions).toEqual(['kanpur']);

    const who = await call(kanpurAdmin, 'GET', '/v1/admin/whoami');
    expect(who.status).toBe(200);
    expect(who.body.admin).toMatchObject({ regions: ['kanpur'], isOwner: false, isGlobal: false });

    expect((await call(kanpurAdmin, 'POST', '/v1/admin/team', { email: 'y@dev.local' })).status).toBe(403);
    expect((await call('root-admin:admin', 'POST', '/v1/admin/team', { email: 'kanpur-admin@dev.local' })).status).toBe(409);
  });

  it('a regional admin only sees and decides for their own cities', async () => {
    const stores = await call(kanpurAdmin, 'GET', '/v1/admin/stores?status=approved');
    expect(stores.status).toBe(200);
    expect(stores.body.stores.length).toBeGreaterThan(0);
    expect(stores.body.stores.every((s: { city: string }) => s.city === 'Kanpur')).toBe(true);

    // Bengaluru is out of scope: it looks like it does not exist, and stays approved.
    expect((await call(kanpurAdmin, 'POST', `/v1/admin/stores/${bengaluruStore}/suspend`, { reason: 'Out of my region' })).status).toBe(404);
    const { rows } = await db.pool.query('select status from stores where id = $1', [bengaluruStore]);
    expect(rows[0].status).toBe('approved');

    const orders = await call(kanpurAdmin, 'GET', '/v1/admin/orders');
    expect(orders.status).toBe(200);
    expect(orders.body.orders.every((o: { storeId: string }) => o.storeId !== bengaluruStore)).toBe(true);

    const overview = await call('root-admin:admin', 'GET', '/v1/admin/overview');
    const regional = await call(kanpurAdmin, 'GET', '/v1/admin/overview');
    expect(regional.body.overview.approvedStores).toBeLessThan(overview.body.overview.approvedStores);

    // Queue counts drive the panel's filter labels and badges, and follow the same scoping.
    const queueAll = await call('root-admin:admin', 'GET', '/v1/admin/queue');
    const queueRegional = await call(kanpurAdmin, 'GET', '/v1/admin/queue');
    expect(queueAll.status).toBe(200);
    expect(queueAll.body.queue.stores.approved).toBe(overview.body.overview.approvedStores);
    expect(queueRegional.body.queue.stores.approved).toBe(regional.body.overview.approvedStores);
    expect(queueAll.body.queue).toHaveProperty('services');
    expect(queueAll.body.queue).toHaveProperty('submissions');

    // The master catalog is company-wide.
    expect((await call(kanpurAdmin, 'POST', '/v1/admin/products', {
      sku: 'SB-REGIONAL', name: 'Regional Admin Widget', categoryId: 'dev-boards', mrp: 100,
    })).status).toBe(403);

    // Regional admins only see audit entries for their cities.
    const auditAll = await call('root-admin:admin', 'GET', '/v1/admin/audit');
    expect(auditAll.body.entries.some((e: { action: string }) => e.action === 'team.add')).toBe(true);
    const auditRegional = await call(kanpurAdmin, 'GET', '/v1/admin/audit');
    expect(auditRegional.body.entries.every((e: { city: string | null }) => e.city === 'kanpur' || e.city === 'Kanpur')).toBe(true);
  });

  it('owners cannot remove themselves, and a removed admin is locked out immediately', async () => {
    expect((await call('root-admin:admin', 'DELETE', '/v1/admin/team/root-admin@dev.local')).status).toBe(409);

    const widened = await call('root-admin:admin', 'PATCH', '/v1/admin/team/kanpur-admin@dev.local', { regions: ['Kanpur', 'Pune'] });
    expect(widened.status).toBe(200);
    expect(widened.body.member.regions).toEqual(['kanpur', 'pune']);
    const stores = await call(kanpurAdmin, 'GET', '/v1/admin/stores?status=approved');
    expect(stores.body.stores.some((s: { id: string }) => s.id === puneStore)).toBe(true);

    expect((await call('root-admin:admin', 'DELETE', '/v1/admin/team/kanpur-admin@dev.local')).status).toBe(200);
    expect((await call(kanpurAdmin, 'GET', '/v1/admin/overview')).status).toBe(403);
    expect((await call('root-admin:admin', 'DELETE', '/v1/admin/team/kanpur-admin@dev.local')).status).toBe(404);
  });
});
