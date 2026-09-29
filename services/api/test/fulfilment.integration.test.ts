import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb } from './testdb.js';

let testDb: Awaited<ReturnType<typeof startTestDb>>;
let server: Server;
let base: string;
let db: typeof import('../src/db/pool.js');
let kanpurStore: string;
let secondKanpurStore: string;
let productA: string;
let productB: string;

// Civil Lines, Kanpur: ~0.5 km from the seeded Kanpur store (Mall Road), nowhere near Bengaluru or Pune.
const KANPUR = { latitude: 26.4534, longitude: 80.3349 };
const NOWHERE = { latitude: 22.0, longitude: 76.0 };
const address = { fullName: 'Ravi Verma', phone: '9876543210', line1: '5 Civil Lines', city: 'Kanpur', pincode: '208001', ...KANPUR };

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
const idem = () => ({ 'Idempotency-Key': `fulfil-key-${Date.now()}-${keyCounter++}` });

beforeAll(async () => {
  testDb = await startTestDb('spaceborn_fulfil', 54331, 'fulfil');

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

  // A second Kanpur store ~150 m from the customer (closer than the seeded one) that only stocks product A.
  await db.pool.query(`insert into users (id, email, role) values ('kanpur-two', 'two@test.local', 'vendor')`);
  const second = await db.pool.query<{ id: string }>(
    `insert into stores (owner_id, name, phone, address_line, city, pincode, latitude, longitude, status, is_online, delivery_radius_km)
     values ('kanpur-two', 'Swaroop Nagar Electronics', '9876500000', 'Swaroop Nagar', 'Kanpur', '208002', $1, $2, 'approved', true, 8)
     returning id`,
    [KANPUR.latitude - 0.001, KANPUR.longitude - 0.001],
  );
  secondKanpurStore = second.rows[0]!.id;
  await db.pool.query('insert into inventory (store_id, product_id, price, stock) values ($1, $2, 1, 100)', [secondKanpurStore, productA]);

  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  server?.close();
  await db?.pool.end();
  await testDb?.stop();
}, 60_000);

describe('location-first catalog', () => {
  it('aggregates products from every nearby store and picks the best offer per product', async () => {
    const res = await call(null, 'GET', `/v1/catalog/products?lat=${KANPUR.latitude}&lng=${KANPUR.longitude}&limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.serviceable).toBe(true);
    expect(res.body.nearbyStores).toBe(2);

    const a = res.body.products.find((p: { id: string }) => p.id === productA);
    expect(a).toBeTruthy();
    // Nearest in-stock store wins: the second store is closer and sells A for ₹1.
    expect(a.storeId).toBe(secondKanpurStore);
    expect(a.price).toBe(1);
    expect(a.offerCount).toBe(2);
    expect(typeof a.etaMinutes).toBe('number');

    const b = res.body.products.find((p: { id: string }) => p.id === productB);
    expect(b.storeId).toBe(kanpurStore);
    expect(b.offerCount).toBe(1);

    const ids = res.body.products.map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is empty where no store delivers', async () => {
    const res = await call(null, 'GET', `/v1/catalog/products?lat=${NOWHERE.latitude}&lng=${NOWHERE.longitude}`);
    expect(res.status).toBe(200);
    expect(res.body.serviceable).toBe(false);
    expect(res.body.products).toHaveLength(0);
  });

  it('returns a single product with all nearby offers', async () => {
    const res = await call(null, 'GET', `/v1/catalog/products/${productA}?lat=${KANPUR.latitude}&lng=${KANPUR.longitude}`);
    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe(productA);
    expect(res.body.offers).toHaveLength(2);
    expect((await call(null, 'GET', `/v1/catalog/products/${productA}?lat=${NOWHERE.latitude}&lng=${NOWHERE.longitude}`)).status).toBe(404);
  });

  it('resolve previews the store that can fulfil the whole cart', async () => {
    const both = await call(null, 'POST', '/v1/catalog/resolve', {
      ...{ lat: KANPUR.latitude, lng: KANPUR.longitude },
      items: [{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }],
    });
    expect(both.status).toBe(200);
    // Only the seeded store has both items, so it beats the closer store.
    expect(both.body.store.id).toBe(kanpurStore);
    expect(both.body.unavailable).toHaveLength(0);
    expect(both.body.pricing.grandTotal).toBeGreaterThan(0);

    const onlyA = await call(null, 'POST', '/v1/catalog/resolve', {
      lat: KANPUR.latitude, lng: KANPUR.longitude, items: [{ productId: productA, quantity: 2 }],
    });
    expect(onlyA.body.store.id).toBe(secondKanpurStore);
    expect(onlyA.body.pricing.itemsTotal).toBe(2);
  });
});

describe('checkout without choosing a vendor', () => {
  it('assigns the order to the nearest store that has everything', async () => {
    const placed = await call('kp-cust:customer', 'POST', '/v1/orders', {
      items: [{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }],
      address,
    }, idem());
    expect(placed.status).toBe(201);
    expect(placed.body.order.storeId).toBe(kanpurStore);
    expect(placed.body.order.status).toBe('pending_payment');
  });

  it('prefers the closer store when it can supply the cart', async () => {
    const placed = await call('kp-cust:customer', 'POST', '/v1/orders', { items: [{ productId: productA, quantity: 1 }], address }, idem());
    expect(placed.status).toBe(201);
    expect(placed.body.order.storeId).toBe(secondKanpurStore);
    expect(placed.body.order.itemsTotal).toBe(1);
  });

  it('refuses when no store nearby has the items, and says which ones', async () => {
    await db.pool.query('update inventory set stock = 0 where product_id = $1', [productB]);
    const placed = await call('kp-cust:customer', 'POST', '/v1/orders', {
      items: [{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }],
      address,
    }, idem());
    expect(placed.status).toBe(409);
    expect(placed.body.error.details.code).toBe('partial_availability');
    expect(placed.body.error.details.items.map((i: { productId: string }) => i.productId)).toEqual([productB]);
    await db.pool.query('update inventory set stock = 10 where product_id = $1', [productB]);
  });

  it('refuses outside every delivery radius', async () => {
    const placed = await call('kp-cust:customer', 'POST', '/v1/orders', {
      items: [{ productId: productA, quantity: 1 }],
      address: { ...address, ...NOWHERE },
    }, idem());
    expect(placed.status).toBe(422);
    expect(placed.body.error.code).toBe('unserviceable');
  });

  it('a paid order queues an email notification for customer and vendor', async () => {
    const placed = await call('kp-cust:customer', 'POST', '/v1/orders', { items: [{ productId: productA, quantity: 1 }], address }, idem());
    const paid = await call('kp-cust:customer', 'POST', '/v1/payments/mock/confirm', { orderId: placed.body.order.id });
    expect(paid.body.order.status).toBe('placed');
    const outbox = await db.pool.query(`select topic from outbox where payload->>'orderId' = $1 order by id`, [placed.body.order.id]);
    expect(outbox.rows.map((r) => r.topic)).toContain('order.placed');

    const { notifyOrderPlaced } = await import('../src/notifications.js');
    await expect(notifyOrderPlaced(placed.body.order.id)).resolves.toBeUndefined();
  });
});
