import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestDb } from './testdb.js';

// The gateway talks to a scripted copilot over real HTTP/SSE, with the real Express app and Postgres.
// An event of the form { delayMs } pauses the stream; `silent` never sends response headers.
type Script = (body: Record<string, any>) => { status?: number; events?: Record<string, unknown>[]; hang?: boolean; silent?: boolean };
const HEADERS_TIMEOUT_MS = 400;

const TOKEN = 'test-copilot-token-0123456789abcdef';
const KANPUR = { lat: 26.4534, lng: 80.3349 };

let testDb: Awaited<ReturnType<typeof startTestDb>>;
let db: typeof import('../src/db/pool.js');
let chat: typeof import('../src/ai/chat.js');
let analytics: typeof import('../src/streams/analytics.js');
let server: Server;
let copilot: Server;
let base: string;
let script: Script;
let received: { headers: http.IncomingHttpHeaders; body: Record<string, any> }[] = [];
let productA: { id: string; name: string };
let productB: { id: string; name: string };
const sockets = new Set<import('node:net').Socket>();

function startCopilot(): Promise<number> {
  copilot = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw);
      received.push({ headers: req.headers, body });
      const out = script(body);
      if (out.silent) return;
      if (out.status && out.status !== 200) {
        res.writeHead(out.status, { 'Content-Type': 'application/json' }).end('{"detail":"boom"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      void (async () => {
        for (const e of out.events ?? []) {
          if (typeof e.delayMs === 'number') await new Promise((r) => setTimeout(r, e.delayMs as number));
          else if (!res.destroyed) res.write(`data: ${JSON.stringify(e)}\n\n`);
        }
        if (!out.hang) res.end();
      })();
    });
  });
  copilot.on('connection', (s) => sockets.add(s));
  return new Promise((resolve) => copilot.listen(0, '127.0.0.1', () => resolve((copilot.address() as AddressInfo).port)));
}

async function ask(as: string | null, body: Record<string, unknown>) {
  const res = await fetch(`${base}/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(as ? { Authorization: `Dev ${as}` } : {}) },
    body: JSON.stringify({ ...KANPUR, ...body }),
  });
  const text = await res.text();
  if (!res.headers.get('content-type')?.includes('text/event-stream')) {
    return { status: res.status, headers: res.headers, events: [] as Record<string, any>[], error: text ? JSON.parse(text) : null };
  }
  const events = text
    .split('\n\n')
    .filter((f) => f.startsWith('data: '))
    .map((f) => JSON.parse(f.slice(6)) as Record<string, any>);
  return { status: res.status, headers: res.headers, events, error: null };
}

const card = (p: { id: string; name: string }) => ({ id: p.id, name: p.name, price: 100, stock: 5, nearbyStock: 5 });
const answer = (text: string, extra: Record<string, unknown>[] = []) => () => ({
  events: [...extra, { type: 'token', text }, { type: 'done', meta: { model: 'fake', toolCalls: [], zeroResultQueries: [] } }],
});

beforeAll(async () => {
  testDb = await startTestDb('spaceborn_ai', 54333, 'ai');
  const port = await startCopilot();
  Object.assign(process.env, {
    COPILOT_URL: `http://127.0.0.1:${port}`,
    COPILOT_TOKEN: TOKEN,
    COPILOT_HEADERS_TIMEOUT_MS: String(HEADERS_TIMEOUT_MS),
    AI_CHAT_PER_10_MIN: '6',
    REDIS_URL: '',
    KAFKA_BROKERS: '',
    AI_MEMORY_TABLE: '',
  });

  db = await import('../src/db/pool.js');
  await (await import('../src/db/migrate.js')).migrate();
  await (await import('../src/db/seed.js')).seed();
  await db.pool.query(`insert into admin_members (email, is_owner, note) values ('root-admin@dev.local', true, 'test owner')`);

  const { rows } = await db.pool.query<{ id: string; name: string }>(
    `select p.id, p.name from inventory i join stores s on s.id = i.store_id join products p on p.id = i.product_id
      where s.owner_id = 'seed-vendor-kanpur' and i.stock > 0 order by p.name limit 2`,
  );
  [productA, productB] = rows as [typeof productA, typeof productB];

  chat = await import('../src/ai/chat.js');
  analytics = await import('../src/streams/analytics.js');
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  server?.close();
  for (const s of sockets) s.destroy();
  copilot?.close();
  await db?.pool.end();
  await testDb?.stop();
}, 60_000);

beforeEach(() => {
  received = [];
  chat.copilotBreaker.success();
  script = answer('Hello');
});

describe('POST /v1/ai/chat', () => {
  it('validates the request', async () => {
    expect((await ask(null, { message: '' })).status).toBe(400);
    expect((await ask(null, { message: 'hi', lat: 200 })).status).toBe(400);
    expect((await ask(null, { message: 'x'.repeat(1001) })).status).toBe(400);
    expect((await ask(null, { message: 'hi', cart: [{ productId: 'nope', quantity: 1 }] })).status).toBe(400);
  });

  it('streams copilot events and drops anything malformed or unsafe', async () => {
    script = () => ({
      events: [
        { type: 'products', products: [card(productA), { id: 'not-a-uuid', name: 'Bad' }, { id: productB.id }] },
        { type: 'token', text: 'Try the ' },
        { type: 'action', action: { kind: 'navigate', path: 'https://evil.example/phish' } },
        { type: 'action', action: { kind: 'navigate', path: '/cart' } },
        { type: 'action', action: { kind: 'add_to_cart', productId: productA.id, quantity: 2, product: card(productB) } },
        { type: 'action', action: { kind: 'add_to_cart', productId: productA.id, quantity: 500, product: card(productA) } },
        { type: 'action', action: { kind: 'add_to_cart', productId: productA.id, quantity: 2, product: card(productA) } },
        { type: 'action', action: { kind: 'run_sql', sql: 'drop table orders' } },
        { type: 'token', text: 'first one.' },
        { type: 'done', meta: { model: 'fake', toolCalls: ['search_catalog'] } },
      ],
    });
    const res = await ask(null, { message: 'motor driver', cart: [{ productId: productB.id, quantity: 3 }] });
    expect(res.status).toBe(200);
    expect(res.events[0]).toMatchObject({ type: 'meta' });
    expect(res.events.at(-1)).toEqual({ type: 'done', mode: 'copilot' });

    const products = res.events.filter((e) => e.type === 'products');
    expect(products).toHaveLength(1);
    expect(products[0]!.products.map((p: { id: string }) => p.id)).toEqual([productA.id]);

    const actions = res.events.filter((e) => e.type === 'action').map((e) => e.action);
    expect(actions).toEqual([
      { kind: 'navigate', path: '/cart' },
      { kind: 'add_to_cart', productId: productA.id, quantity: 2, product: card(productA) },
    ]);
    expect(res.events.filter((e) => e.type === 'token').map((e) => e.text).join('')).toBe('Try the first one.');

    // The copilot got the shared secret, the location, and cart names from the catalog, not the browser.
    expect(received).toHaveLength(1);
    expect(received[0]!.headers['x-internal-token']).toBe(TOKEN);
    const ctx = received[0]!.body.context;
    expect(ctx).toMatchObject({ lat: KANPUR.lat, lng: KANPUR.lng, signedIn: false, authorization: null });
    expect(ctx.cart).toEqual([expect.objectContaining({ productId: productB.id, name: productB.name, quantity: 3 })]);
  });

  it('remembers the conversation for its owner only', async () => {
    script = answer('Sure, here it is.', [{ type: 'products', products: [card(productA)] }]);
    const first = await ask('mem-user:customer', { message: 'esp32 board' });
    const conversationId = first.events[0]!.conversationId as string;

    script = answer('It ships in 15 minutes.');
    await ask('mem-user:customer', { message: 'how fast?', conversationId });
    const second = received.at(-1)!.body;
    expect(second.history).toEqual([
      { role: 'user', text: 'esp32 board' },
      { role: 'assistant', text: 'Sure, here it is.' },
    ]);
    expect(second.context.recentProducts).toEqual([{ id: productA.id, name: productA.name }]);
    expect(second.context).toMatchObject({ signedIn: true, authorization: 'Dev mem-user:customer' });

    // Someone else presenting the same id starts from an empty conversation.
    await ask('other-user:customer', { message: 'what did I ask?', conversationId });
    expect(received.at(-1)!.body.history).toEqual([]);
    await ask(null, { message: 'what did I ask?', conversationId });
    expect(received.at(-1)!.body.history).toEqual([]);
  });

  it('answers with nearby search when the copilot fails, and stops calling it after three failures', async () => {
    script = () => ({ status: 500 });
    const word = productA.name.split(/\s+/)[0]!;
    for (let i = 0; i < 3; i++) {
      const res = await ask(`fallback-${i}:customer`, { message: word });
      expect(res.events.at(-1)).toEqual({ type: 'done', mode: 'fallback' });
      const products = res.events.find((e) => e.type === 'products');
      expect(products?.products.length).toBeGreaterThan(0);
    }
    expect(received).toHaveLength(3);
    expect(chat.copilotBreaker.state).toBe('open');

    const res = await ask('fallback-4:customer', { message: word });
    expect(res.events.at(-1)).toEqual({ type: 'done', mode: 'fallback' });
    expect(received).toHaveLength(3);
  });

  it('does not append search results to an answer that was cut off', async () => {
    script = () => ({ events: [{ type: 'token', text: 'The best option is' }] });
    const res = await ask('cutoff:customer', { message: 'which servo?' });
    const types = res.events.map((e) => e.type);
    expect(types).toEqual(['meta', 'token', 'error', 'done']);
    expect(res.events.at(-1)).toEqual({ type: 'done', mode: 'copilot' });
  });

  it('keeps streaming an answer that takes longer than the header timeout', async () => {
    script = () => ({
      events: [
        { type: 'token', text: 'Checking stock' },
        { delayMs: HEADERS_TIMEOUT_MS * 3 },
        { type: 'token', text: ' nearby.' },
        { type: 'done', meta: {} },
      ],
    });
    const res = await ask('slow:customer', { message: 'slow answer' });
    expect(res.events.filter((e) => e.type === 'token').map((e) => e.text).join('')).toBe('Checking stock nearby.');
    expect(res.events.at(-1)).toEqual({ type: 'done', mode: 'copilot' });
    expect(chat.copilotBreaker.state).toBe('closed');
  });

  it('falls back when the copilot never starts answering', async () => {
    script = () => ({ silent: true });
    const started = Date.now();
    const res = await ask('silent-copilot:customer', { message: productA.name });
    expect(res.events.at(-1)).toEqual({ type: 'done', mode: 'fallback' });
    expect(Date.now() - started).toBeLessThan(HEADERS_TIMEOUT_MS + 3000);
  });

  it('falls back when the copilot finishes without writing anything', async () => {
    script = () => ({ events: [{ type: 'done', meta: {} }] });
    const res = await ask('silent:customer', { message: productA.name });
    expect(res.events.at(-1)).toEqual({ type: 'done', mode: 'fallback' });
    expect(res.events.some((e) => e.type === 'token')).toBe(true);
  });

  it('rate limits each customer', async () => {
    for (let i = 0; i < 6; i++) expect((await ask('busy-user:customer', { message: `q${i}` })).status).toBe(200);
    const blocked = await ask('busy-user:customer', { message: 'one more' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await ask('calm-user:customer', { message: 'hi' })).status).toBe(200);
  });
});

describe('stream analytics', () => {
  const topics = { ai: 'spaceborn.ai-events', domain: 'spaceborn.domain-events' };
  const aiEvent = {
    eventId: 'evt-1',
    type: 'ai.chat.completed',
    at: '2026-03-01T10:00:00Z',
    mode: 'copilot',
    outcome: 'answered',
    area: { lat: 26.45, lng: 80.33, label: 'Kanpur' },
    zeroResultQueries: ['LiDAR  Sensor', 'lidar sensor'],
    usage: { input: 1200, output: 300 },
    latencyMs: 1800,
  };

  it('applies each event once even when Kafka redelivers it', async () => {
    const apply = (offset: string, value: Record<string, unknown>, topic = topics.ai) =>
      db.withTransaction((c) => analytics.applyRecord(c, 'test-group', { topic, partition: 0, offset, value }, topics));

    expect(await apply('10', aiEvent)).toBe(true);
    // Same event after a broker reset: different offset, same id.
    expect(await apply('0', aiEvent)).toBe(false);

    const usage = await db.pool.query(`select chats, answered, input_tokens::int as i, output_tokens::int as o from ai_usage_daily where day = '2026-03-01'`);
    expect(usage.rows).toEqual([{ chats: 1, answered: 1, i: 1200, o: 300 }]);
    const demand = await db.pool.query(`select query, misses, area_label from ai_demand_signals`);
    expect(demand.rows).toEqual([{ query: 'lidar sensor', misses: 1, area_label: 'Kanpur' }]);

    await apply('11', { eventId: 7, type: 'order.status_changed', occurredAt: '2026-03-01T10:05:00Z', data: { to: 'delivered' } }, topics.domain);
    await apply('12', { eventId: 7, type: 'order.status_changed', occurredAt: '2026-03-01T10:05:00Z', data: { to: 'delivered' } }, topics.domain);
    const funnel = await db.pool.query(`select status, events from order_funnel_daily where day = '2026-03-01'`);
    expect(funnel.rows).toEqual([{ status: 'delivered', events: 1 }]);
  });

  it('shows insights to global admins only', async () => {
    const customer = await fetch(`${base}/v1/admin/ai/insights`, { headers: { Authorization: 'Dev some-user:customer' } });
    expect(customer.status).toBe(403);
    const admin = await fetch(`${base}/v1/admin/ai/insights`, { headers: { Authorization: 'Dev root-admin:admin' } });
    expect(admin.status).toBe(200);
    const body = await admin.json();
    expect(body).toHaveProperty('usage');
    expect(body).toHaveProperty('funnel');
    expect(Array.isArray(body.demand)).toBe(true);
    for (const row of body.usage as { inputTokens: unknown; outputTokens: unknown }[]) {
      expect(typeof row.inputTokens).toBe('number');
      expect(typeof row.outputTokens).toBe('number');
    }
  });
});
