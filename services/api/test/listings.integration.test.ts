import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CITY_ALIASES, cityKey } from '../src/lib/city.js';
import { startTestDb } from './testdb.js';

// Two shops selling the same part: price notices and holds above MRP, part-number matching,
// restocks through review, and the region and paging rules around them.

let testDb: Awaited<ReturnType<typeof startTestDb>>;
let server: Server;
let base: string;
let db: typeof import('../src/db/pool.js');
let kanpurStore: string;
let secondStore: string;
let productId: string;

const KANPUR = { latitude: 26.4534, longitude: 80.3349 };
const address = { fullName: 'Ravi Verma', phone: '9876543210', line1: '5 Civil Lines', city: 'Kanpur', pincode: '208001', ...KANPUR };
const ADMIN = 'root-admin:admin';
const vendorKanpur = () => `seed-vendor-kanpur:vendor:${kanpurStore}`;
const vendorTwo = () => `kanpur-two:vendor:${secondStore}`;

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
const newKey = () => `listings-key-${Date.now()}-${keyCounter++}`;

async function uploadImage(as: string, colour: { r: number; g: number; b: number }) {
  const png = await sharp({ create: { width: 200, height: 160, channels: 3, background: colour } }).png().toBuffer();
  const res = await fetch(`${base}/v1/vendor/product-images`, {
    method: 'POST',
    headers: { Authorization: `Dev ${as}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': 'part.png' },
    body: new Uint8Array(png),
  });
  return ((await res.json()) as { imageKey: string }).imageKey;
}

const listing = async (storeId: string, product = productId) =>
  (await db.pool.query('select price, stock, is_listed, hold_kind from inventory where store_id = $1 and product_id = $2', [storeId, product])).rows[0];

const lastMessage = async (storeId: string) =>
  (await db.pool.query<{ body: string }>('select body from store_messages where store_id = $1 order by id desc limit 1', [storeId])).rows[0]?.body ?? '';

beforeAll(async () => {
  testDb = await startTestDb('spaceborn_listings', 54335, 'listings');
  db = await import('../src/db/pool.js');
  await (await import('../src/db/migrate.js')).migrate();
  await (await import('../src/db/seed.js')).seed();

  const stores = await db.pool.query<{ id: string; owner_id: string }>('select id, owner_id from stores');
  kanpurStore = stores.rows.find((s) => s.owner_id === 'seed-vendor-kanpur')!.id;
  productId = (await db.pool.query<{ product_id: string }>(
    'select product_id from inventory where store_id = $1 order by product_id limit 1',
    [kanpurStore],
  )).rows[0]!.product_id;

  // A second Kanpur shop selling the same product, a little further from the customer.
  await db.pool.query(`insert into users (id, email, role) values ('kanpur-two', 'two@test.local', 'vendor')`);
  secondStore = (await db.pool.query<{ id: string }>(
    `insert into stores (owner_id, name, phone, address_line, city, pincode, latitude, longitude, status, is_online, delivery_radius_km)
     values ('kanpur-two', 'Swaroop Nagar Electronics', '9876500000', 'Swaroop Nagar', 'Kanpur Nagar', '208002', $1, $2, 'approved', true, 8)
     returning id`,
    [KANPUR.latitude + 0.01, KANPUR.longitude + 0.01],
  )).rows[0]!.id;
  await db.pool.query('delete from inventory where product_id = $1 and store_id <> $2', [productId, kanpurStore]);
  await db.pool.query('update products set mrp = 1000 where id = $1', [productId]);
  await db.pool.query('update inventory set price = 900, stock = 40 where store_id = $1 and product_id = $2', [kanpurStore, productId]);
  await db.pool.query('insert into inventory (store_id, product_id, price, stock) values ($1, $2, 950, 10)', [secondStore, productId]);
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

describe('two shops, one product', () => {
  it('the customer sees the nearest shop’s price, and the other shop fills in when it runs out', async () => {
    const at = `lat=${KANPUR.latitude}&lng=${KANPUR.longitude}`;
    const detail = await call(null, 'GET', `/v1/catalog/products/${productId}?${at}`);
    expect(detail.status).toBe(200);
    expect(Number(detail.body.product.price)).toBe(900);
    expect(detail.body.offers).toHaveLength(2);

    await db.pool.query('update inventory set stock = 0 where store_id = $1 and product_id = $2', [kanpurStore, productId]);
    await (await import('../src/cache.js')).bumpCatalog();
    const spill = await call(null, 'GET', `/v1/catalog/products/${productId}?${at}`);
    expect(Number(spill.body.product.price)).toBe(950);
    await db.pool.query('update inventory set stock = 40 where store_id = $1 and product_id = $2', [kanpurStore, productId]);
    await (await import('../src/cache.js')).bumpCatalog();
  });
});

describe('selling above a lowered MRP', () => {
  it('admin lowers the MRP, asks the shop to reprice, takes the listing down, and repricing brings it back', async () => {
    const lowered = await call(ADMIN, 'PATCH', `/v1/admin/products/${productId}`, { mrp: 920 });
    expect(lowered.status).toBe(200);
    expect(lowered.body.offersAboveMrp).toBe(1);

    const shelf = await call(ADMIN, 'GET', `/v1/admin/stores/${secondStore}/inventory`);
    const row = shelf.body.items.find((i: { productId: string }) => i.productId === productId);
    expect(row).toMatchObject({ aboveMrp: true, holdKind: null });
    expect(shelf.body.summary.aboveMrp).toBe(1);

    // The shop under the MRP gets no notice.
    expect((await call(ADMIN, 'POST', `/v1/admin/stores/${kanpurStore}/inventory/${productId}/price-notice`, {})).status).toBe(409);
    const notice = await call(ADMIN, 'POST', `/v1/admin/stores/${secondStore}/inventory/${productId}/price-notice`, {});
    expect(notice.status).toBe(200);
    expect(await lastMessage(secondStore)).toContain('₹920');
    expect((await call(vendorTwo(), 'GET', '/v1/vendor/messages')).body.messages.at(-1).body).toContain('Price notice');

    const held = await call(ADMIN, 'POST', `/v1/admin/stores/${secondStore}/inventory/${productId}/hold`, { reason: 'Still above the MRP after our notice' });
    expect(held.status).toBe(200);
    expect(held.body.item).toMatchObject({ isListed: false, holdKind: 'above_mrp' });
    expect(await listing(secondStore)).toMatchObject({ is_listed: false, hold_kind: 'above_mrp' });
    const offers = await call(null, 'GET', `/v1/catalog/products/${productId}?lat=${KANPUR.latitude}&lng=${KANPUR.longitude}`);
    expect(offers.body.offers).toHaveLength(1);

    // Relisting at the old price is refused; a price at or under the MRP lifts the hold.
    const relist = await call(vendorTwo(), 'PUT', `/v1/vendor/inventory/${productId}`, { isListed: true });
    expect(relist.status).toBe(422);
    expect(relist.body.error.code).toBe('price_above_mrp');
    const repriced = await call(vendorTwo(), 'PUT', `/v1/vendor/inventory/${productId}`, { price: 915 });
    expect(repriced.status).toBe(200);
    expect(repriced.body.item).toMatchObject({ isListed: true, holdKind: null });
  });

  it('an admin hold for another reason stays until an admin lifts it', async () => {
    const held = await call(ADMIN, 'POST', `/v1/admin/stores/${secondStore}/inventory/${productId}/hold`, { reason: 'Customers report counterfeit parts' });
    expect(held.body.item.holdKind).toBe('admin');

    const relist = await call(vendorTwo(), 'PUT', `/v1/vendor/inventory/${productId}`, { isListed: true });
    expect(relist.status).toBe(409);
    expect(relist.body.error.details.code).toBe('listing_on_hold');
    expect((await call(vendorTwo(), 'PUT', `/v1/vendor/inventory/${productId}`, { price: 900 })).status).toBe(200);
    expect(await listing(secondStore)).toMatchObject({ is_listed: false, hold_kind: 'admin' });
    // Deleting and re-adding would dodge the hold.
    expect((await call(vendorTwo(), 'DELETE', `/v1/vendor/inventory/${productId}`)).status).toBe(409);

    // A regional admin for another city cannot touch it.
    await db.pool.query(`insert into admin_members (email, regions, note) values ('pune-admin@dev.local', '{pune}', 'regional')`);
    expect((await call('pune-admin:admin', 'DELETE', `/v1/admin/stores/${secondStore}/inventory/${productId}/hold`)).status).toBe(404);

    const lifted = await call(ADMIN, 'DELETE', `/v1/admin/stores/${secondStore}/inventory/${productId}/hold`);
    expect(lifted.status).toBe(200);
    expect(lifted.body.item).toMatchObject({ isListed: true, holdKind: null });
    expect(await lastMessage(secondStore)).toContain('back on the website');
  });
});

describe('part numbers and restocks', () => {
  it('matches a proposal by part number, restocks the shop that already sells it and can take its photo', async () => {
    await db.pool.query(`update products set mpn = 'ATmega328P-PU', brand = 'Microchip' where id = $1`, [productId]);
    const category = (await db.pool.query<{ category_id: string; mrp: string; image_key: string | null }>(
      'select category_id, mrp, image_key from products where id = $1',
      [productId],
    )).rows[0]!;

    const imageKey = await uploadImage(vendorTwo(), { r: 20, g: 120, b: 220 });
    const created = await call(vendorTwo(), 'POST', '/v1/vendor/product-submissions', {
      name: 'Arduino-compatible AVR chip, DIP-28',
      description: 'Genuine 8-bit AVR microcontroller in a DIP package, fresh stock.',
      categoryId: category.category_id,
      brand: 'Microchip',
      mpn: 'atmega328p pu',
      mrp: Number(category.mrp),
      price: 880,
      stock: 25,
      imageKey,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.submission.id;

    // Different title and photo, same part number: the review puts it first as the same part.
    const review = await call(ADMIN, 'GET', `/v1/admin/product-submissions/${id}`);
    expect(review.body.similar[0]).toMatchObject({ id: productId, mpnMatch: true, likelyDuplicate: true });

    // Approving it as a separate product would duplicate the listing.
    const asNew = await call(ADMIN, 'POST', `/v1/admin/product-submissions/${id}/approve`, {});
    expect(asNew.status).toBe(409);
    expect(asNew.body.error.details.code).toBe('mpn_taken');

    const before = await listing(secondStore);
    const merged = await call(ADMIN, 'POST', `/v1/admin/product-submissions/${id}/approve`, { mergeIntoProductId: productId, usePhoto: true });
    expect(merged.status, JSON.stringify(merged.body)).toBe(200);
    expect(merged.body.submission.toppedUp).toBe(true);
    const after = await listing(secondStore);
    expect(after.stock).toBe(before.stock + 25);
    expect(Number(after.price)).toBe(880);
    const photo = await db.pool.query<{ image_key: string }>('select image_key from products where id = $1', [productId]);
    expect(photo.rows[0]!.image_key).toBe(imageKey);
  });

  it('a regional admin may attach stock but not replace the catalog photo', async () => {
    const category = (await db.pool.query<{ category_id: string }>('select category_id from products where id = $1', [productId])).rows[0]!;
    await db.pool.query(`insert into admin_members (email, regions, note) values ('kanpur-admin@dev.local', '{kanpur}', 'regional')`);
    const imageKey = await uploadImage(vendorKanpur(), { r: 220, g: 220, b: 40 });
    const created = await call(vendorKanpur(), 'POST', '/v1/vendor/product-submissions', {
      name: 'ATmega328P restock', description: 'Another box of the same chip for the shelf.', categoryId: category.category_id,
      brand: 'Microchip', mpn: 'ATMEGA328P-PU', mrp: 920, price: 900, stock: 5, imageKey,
    });
    const id = created.body.submission.id;
    const photo = await call('kanpur-admin:admin', 'POST', `/v1/admin/product-submissions/${id}/approve`, { mergeIntoProductId: productId, usePhoto: true });
    expect(photo.status).toBe(403);
    const plain = await call('kanpur-admin:admin', 'POST', `/v1/admin/product-submissions/${id}/approve`, { mergeIntoProductId: productId });
    expect(plain.status).toBe(200);
  });
});

describe('city names', () => {
  it('the SQL and TypeScript city keys agree', async () => {
    const samples = ['Kanpur Nagar', ' kanpur ', 'Cawnpore', 'Bangalore', 'Bengaluru Urban', 'New Delhi', 'Navi Mumbai', 'Pune City',
      'Ahmednagar', 'St. Thomas Mount', 'Gautam Buddha Nagar', ...Object.keys(CITY_ALIASES)];
    const { rows } = await db.pool.query<{ city: string; key: string }>(
      'select c as city, sb_city_key(c) as key from unnest($1::text[]) c',
      [samples],
    );
    for (const row of rows) expect(row.key, row.city).toBe(cityKey(row.city));
    expect(cityKey('Kanpur Nagar')).toBe('kanpur');
    expect(cityKey('Bangalore')).toBe('bengaluru');
    expect(cityKey('Ahmednagar')).toBe('ahmednagar');
  });

  it('a Kanpur admin sees the shop whose city was typed “Kanpur Nagar”', async () => {
    const stores = await call('kanpur-admin:admin', 'GET', '/v1/admin/stores?status=approved');
    expect(stores.body.stores.map((s: { id: string }) => s.id)).toEqual(expect.arrayContaining([kanpurStore, secondStore]));
    const regions = await call(ADMIN, 'GET', '/v1/admin/regions');
    expect(regions.body.regions.find((r: { city: string }) => r.city === 'kanpur').stores).toBe(2);
    const added = await call(ADMIN, 'POST', '/v1/admin/team', { email: 'blr-admin@dev.local', regions: ['Bangalore'] });
    expect(added.body.member.regions).toEqual(['bengaluru']);
  });
});

describe('shop cancellations and order history', () => {
  async function paidOrder(customer: string, quantity: number) {
    const placed = await call(`${customer}:customer`, 'POST', '/v1/orders', { items: [{ productId, quantity }], address }, { 'Idempotency-Key': newKey() });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    const orderId: string = placed.body.order?.id ?? placed.body.orders[0].id;
    expect((await call(`${customer}:customer`, 'POST', '/v1/payments/mock/confirm', { orderId })).status).toBe(200);
    return orderId;
  }

  it('a damaged item does not go back on the shelf; a normal cancel restocks', async () => {
    const start = (await listing(kanpurStore)).stock;
    const damaged = await paidOrder('restock-a', 2);
    const cancel = await call(vendorKanpur(), 'POST', `/v1/vendor/orders/${damaged}/transition`, {
      to: 'cancelled', reason: 'Both units arrived damaged from the supplier', restock: false,
    });
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
    expect((await listing(kanpurStore)).stock).toBe(start - 2);

    const normal = await paidOrder('restock-b', 1);
    await call(vendorKanpur(), 'POST', `/v1/vendor/orders/${normal}/transition`, { to: 'cancelled', reason: 'Closing early today' });
    expect((await listing(kanpurStore)).stock).toBe(start - 2);
    const shown = await call('restock-b:customer', 'GET', '/v1/orders');
    expect(shown.body.orders[0].cancelReason).toBe('Closing early today');
  });

  it('a customer can page through older orders', async () => {
    for (let i = 0; i < 3; i++) await paidOrder('pager', 1);
    const first = await call('pager:customer', 'GET', '/v1/orders?limit=2&offset=0');
    const second = await call('pager:customer', 'GET', '/v1/orders?limit=2&offset=2');
    expect(first.body.orders).toHaveLength(2);
    expect(second.body.orders).toHaveLength(1);
    const ids = new Set([...first.body.orders, ...second.body.orders].map((o: { id: string }) => o.id));
    expect(ids.size).toBe(3);
  });
});
