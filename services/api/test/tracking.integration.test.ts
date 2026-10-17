import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb } from './testdb.js';

// Live delivery tracking: the store's own rider shares a position, the customer's stream shows it.
// Plus the vendor's "demand nearby" view of unmet copilot searches.

let testDb: Awaited<ReturnType<typeof startTestDb>>;
let server: Server;
let base: string;
let db: typeof import('../src/db/pool.js');
let bengaluruStore: string;
let puneStore: string;
let productId: string;

const KORAMANGALA = { latitude: 12.9345, longitude: 77.6268 };
const address = { fullName: 'Asha Rao', phone: '9876543210', line1: '12 Main Road', city: 'Bengaluru', pincode: '560034', ...KORAMANGALA };

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
const idem = () => ({ 'Idempotency-Key': `track-key-${Date.now()}-${keyCounter++}` });
const vendorBlr = () => `seed-vendor-bengaluru:vendor:${bengaluruStore}`;
const vendorPune = () => `seed-vendor-pune:vendor:${puneStore}`;

interface Frame {
  event: string;
  data: Record<string, unknown>;
}

/** Opens the SSE stream and resolves once `count` frames arrived or the stream closed. */
async function readStream(as: string, url: string, count: number, onOpen?: () => Promise<void>, timeoutMs = 8_000) {
  const abort = new AbortController();
  const res = await fetch(`${base}${url}`, { headers: { Authorization: `Dev ${as}`, Accept: 'text/event-stream' }, signal: abort.signal });
  if (!res.ok || !res.body) {
    const text = await res.text();
    return { status: res.status, frames: [] as Frame[], error: text ? JSON.parse(text) : null };
  }
  const frames: Frame[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  let opened = false;
  try {
    while (frames.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = raw.split('\n');
        const data = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
        if (!data) continue;
        const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim() ?? 'message';
        frames.push({ event, data: JSON.parse(data) });
      }
      if (!opened && onOpen) {
        opened = true;
        await onOpen();
      }
    }
  } catch {
    // aborted by the timer
  } finally {
    clearTimeout(timer);
    abort.abort();
    await reader.cancel().catch(() => undefined);
  }
  return { status: res.status, frames, error: null };
}

async function placeAndDispatch(customer: string) {
  const placed = await call(`${customer}:customer`, 'POST', '/v1/orders', { items: [{ productId, quantity: 1 }], address }, idem());
  expect(placed.status).toBe(201);
  const orderId = placed.body.order.id as string;
  const paid = await call(`${customer}:customer`, 'POST', '/v1/payments/mock/confirm', { orderId });
  expect(paid.body.order.status).toBe('placed');
  for (const to of ['accepted', 'packing', 'ready_for_pickup']) {
    const r = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to });
    expect(r.status).toBe(200);
  }
  return orderId;
}

beforeAll(async () => {
  testDb = await startTestDb('spaceborn_track', 54332, 'track');

  db = await import('../src/db/pool.js');
  await (await import('../src/db/migrate.js')).migrate();
  await (await import('../src/db/seed.js')).seed();

  const stores = await db.pool.query<{ id: string; owner_id: string }>('select id, owner_id from stores');
  bengaluruStore = stores.rows.find((s) => s.owner_id === 'seed-vendor-bengaluru')!.id;
  puneStore = stores.rows.find((s) => s.owner_id === 'seed-vendor-pune')!.id;
  const product = await db.pool.query<{ product_id: string }>('select product_id from inventory where store_id = $1 order by product_id limit 1', [
    bengaluruStore,
  ]);
  productId = product.rows[0]!.product_id;

  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  server?.close();
  await db?.pool.end();
  await testDb?.stop();
}, 60_000);

describe('live delivery tracking', () => {
  it('refuses a rider position until the order is out for delivery, and from any other store', async () => {
    const orderId = await placeAndDispatch('track-a');
    const early = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/location`, { lat: 12.93, lng: 77.62 });
    expect(early.status).toBe(409);
    const other = await call(vendorPune(), 'POST', `/v1/vendor/orders/${orderId}/location`, { lat: 12.93, lng: 77.62 });
    expect(other.status).toBe(404);
    const garbage = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/location`, { lat: 123, lng: 77.62 });
    expect(garbage.status).toBe(400);
  });

  it('streams the snapshot, then the rider position with distance and ETA, only to the order owner', async () => {
    const orderId = await placeAndDispatch('track-b');
    const out = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to: 'out_for_delivery' });
    expect(out.status).toBe(200);

    // Someone else's order: no stream, no leak.
    const stranger = await readStream('track-z:customer', `/v1/orders/${orderId}/track`, 1);
    expect(stranger.status).toBe(404);

    // ~1.1 km north of the customer.
    const riderAt = { lat: KORAMANGALA.latitude + 0.01, lng: KORAMANGALA.longitude };
    const stream = await readStream('track-b:customer', `/v1/orders/${orderId}/track`, 2, async () => {
      const ack = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/location`, riderAt);
      expect(ack.status).toBe(200);
      expect(ack.body.remainingKm).toBeGreaterThan(0.9);
      expect(ack.body.remainingKm).toBeLessThan(1.3);
      expect(ack.body.etaMinutes).toBeGreaterThanOrEqual(1);
    });
    expect(stream.status).toBe(200);
    expect(stream.frames[0]?.event).toBe('snapshot');
    const snapshot = stream.frames[0]!.data;
    expect(snapshot.status).toBe('out_for_delivery');
    expect(snapshot.live).toBe(true);
    expect(snapshot.destination).toEqual({ lat: KORAMANGALA.latitude, lng: KORAMANGALA.longitude });
    // The shop's position is rounded: a neighbourhood, not a door.
    const origin = snapshot.origin as { lat: number; lng: number };
    expect(origin.lat).toBe(Number(origin.lat.toFixed(3)));
    expect(snapshot.rider).toBeNull();

    const position = stream.frames.find((f) => f.event === 'position' || (f.event === 'snapshot' && f.data.rider));
    expect(position).toBeTruthy();
    const rider = (position!.event === 'position' ? position!.data : position!.data.rider) as Record<string, number>;
    expect(rider.lat).toBeCloseTo(riderAt.lat, 5);
    expect(rider.lng).toBeCloseTo(riderAt.lng, 5);
    expect(rider.remainingKm).toBeGreaterThan(0.9);
    expect(typeof rider.etaMinutes).toBe('number');

    // A later GET of the order list still works and does not expose the rider fields to the customer.
    const list = await call('track-b:customer', 'GET', '/v1/orders');
    expect(list.body.orders[0].storeId).toBeUndefined();
  });

  it('closes the stream when the order ends', async () => {
    const orderId = await placeAndDispatch('track-c');
    await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to: 'out_for_delivery' });
    const stream = await readStream('track-c:customer', `/v1/orders/${orderId}/track`, 3, async () => {
      await db.pool.query(`update orders set handover_otp = '1234', handover_otp_expires_at = now() + interval '5 minutes' where id = $1`, [orderId]);
      const done = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/transition`, { to: 'delivered', otp: '1234' });
      expect(done.status).toBe(200);
    });
    const last = stream.frames[stream.frames.length - 1]!;
    expect(['status', 'snapshot']).toContain(last.event);
    const statuses = stream.frames.map((f) => (f.event === 'status' ? f.data.status : f.data.status));
    expect(statuses).toContain('delivered');
    // The position endpoint is shut once delivered.
    const late = await call(vendorBlr(), 'POST', `/v1/vendor/orders/${orderId}/location`, { lat: 12.93, lng: 77.62 });
    expect(late.status).toBe(409);
  });
});

describe('vendor demand nearby', () => {
  it('lists unmet copilot searches within the store area only, nearest-first by misses', async () => {
    const blr = await db.pool.query<{ latitude: number; longitude: number }>(`select latitude::float8 as latitude, longitude::float8 as longitude from stores where id = $1`, [
      bengaluruStore,
    ]);
    const { latitude, longitude } = blr.rows[0]!;
    await db.pool.query(
      `insert into ai_demand_signals (query, area_lat, area_lng, area_label, misses, last_seen) values
         ('lidar sensor', round($1::numeric, 2), round($2::numeric, 2), 'Koramangala', 4, now()),
         ('nema 23 stepper', round($1::numeric, 2) + 0.03, round($2::numeric, 2), 'Indiranagar', 2, now() - interval '2 days'),
         ('old thing', round($1::numeric, 2), round($2::numeric, 2) + 0.01, 'Koramangala', 9, now() - interval '40 days'),
         ('far away', round($1::numeric, 2) + 5, round($2::numeric, 2), 'Elsewhere', 50, now())`,
      [latitude, longitude],
    );

    const res = await call(vendorBlr(), 'GET', '/v1/vendor/demand');
    expect(res.status).toBe(200);
    expect(res.body.center).toEqual({ lat: latitude, lng: longitude });
    expect(res.body.radiusKm).toBeGreaterThanOrEqual(8);
    const queries = res.body.signals.map((s: { query: string }) => s.query);
    expect(queries).toEqual(['lidar sensor', 'nema 23 stepper']);
    expect(res.body.signals[0].distanceKm).toBeLessThan(2);
    expect(typeof res.body.signals[0].lastSeen).toBe('string');

    // Pune's shop sees none of Bengaluru's demand.
    const pune = await call(vendorPune(), 'GET', '/v1/vendor/demand');
    expect(pune.body.signals).toEqual([]);

    // Customers cannot read it.
    expect((await call('track-b:customer', 'GET', '/v1/vendor/demand')).status).toBe(403);
  });
});
