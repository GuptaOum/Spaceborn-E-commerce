import { beforeAll, describe, expect, it } from 'vitest';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_NAME: 'unused',
  DB_USER: 'unused',
  DB_PASSWORD: 'unused',
  FIREBASE_PROJECT_ID: 'spaceborn-test',
  LOG_LEVEL: 'silent',
});

let CircuitBreaker: typeof import('../src/lib/breaker.js').CircuitBreaker;
let rate: typeof import('../src/lib/rateLimit.js');
let celeryMessage: typeof import('../src/streams/celery.js').celeryMessage;
let domainEvent: typeof import('../src/streams/relay.js').domainEvent;
let normaliseQuery: typeof import('../src/streams/analytics.js').normaliseQuery;
let mergeShown: typeof import('../src/ai/chat.js').mergeShown;

beforeAll(async () => {
  ({ CircuitBreaker } = await import('../src/lib/breaker.js'));
  rate = await import('../src/lib/rateLimit.js');
  ({ celeryMessage } = await import('../src/streams/celery.js'));
  ({ domainEvent } = await import('../src/streams/relay.js'));
  ({ normaliseQuery } = await import('../src/streams/analytics.js'));
  ({ mergeShown } = await import('../src/ai/chat.js'));
});

describe('circuit breaker', () => {
  it('opens after consecutive failures and lets one trial through after the cooldown', () => {
    let now = 0;
    const b = new CircuitBreaker(3, 1000, () => now);
    for (let i = 0; i < 3; i++) {
      expect(b.tryAcquire()).toBe(true);
      b.failure();
    }
    expect(b.state).toBe('open');
    expect(b.tryAcquire()).toBe(false);

    now = 1000;
    expect(b.state).toBe('half-open');
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(false);
    b.failure();
    expect(b.state).toBe('open');

    now = 2000;
    expect(b.tryAcquire()).toBe(true);
    b.success();
    expect(b.state).toBe('closed');
    expect(b.tryAcquire()).toBe(true);
  });

  it('a released trial does not count either way', () => {
    let now = 0;
    const b = new CircuitBreaker(1, 1000, () => now);
    b.failure();
    now = 1000;
    expect(b.tryAcquire()).toBe(true);
    b.release();
    expect(b.state).toBe('half-open');
    expect(b.tryAcquire()).toBe(true);
  });

  it('success resets the failure count', () => {
    const b = new CircuitBreaker(2, 1000, () => 0);
    b.failure();
    b.success();
    b.failure();
    expect(b.state).toBe('closed');
  });
});

describe('rate limiter without Redis', () => {
  it('blocks past the limit until the window rolls over', async () => {
    rate.resetLocalLimits();
    const windows = [{ name: 't', seconds: 60, max: 2 }];
    const t0 = 120_000;
    expect((await rate.consume('a', windows, t0)).allowed).toBe(true);
    expect((await rate.consume('a', windows, t0)).allowed).toBe(true);
    const blocked = await rate.consume('a', windows, t0 + 15_000);
    expect(blocked).toEqual({ allowed: false, retryAfter: 45 });
    expect((await rate.consume('b', windows, t0)).allowed).toBe(true);
    expect((await rate.consume('a', windows, t0 + 60_000)).allowed).toBe(true);
  });

  it('reports the window that blocked when several apply', async () => {
    rate.resetLocalLimits();
    const windows = [
      { name: 'short', seconds: 10, max: 5 },
      { name: 'long', seconds: 100, max: 1 },
    ];
    await rate.consume('c', windows, 0);
    expect(await rate.consume('c', windows, 1000)).toEqual({ allowed: false, retryAfter: 99 });
  });
});

describe('celery message', () => {
  it('is a protocol 2 task message that kombu routes to the queue', () => {
    const raw = JSON.parse(celeryMessage('spaceborn.analyze_cad_file', ['file-1'], 'cad', 'task-1'));
    expect(raw['content-type']).toBe('application/json');
    expect(raw.headers).toMatchObject({ lang: 'py', task: 'spaceborn.analyze_cad_file', id: 'task-1', root_id: 'task-1', ignore_result: true });
    expect(raw.properties).toMatchObject({ body_encoding: 'base64', delivery_info: { exchange: '', routing_key: 'cad' }, correlation_id: 'task-1' });
    const body = JSON.parse(Buffer.from(raw.body, 'base64').toString('utf8'));
    expect(body).toEqual([['file-1'], {}, { callbacks: null, errbacks: null, chain: null, chord: null }]);
  });
});

describe('outbox relay', () => {
  it('streams identifiers and state changes only, keyed by the aggregate', () => {
    const event = domainEvent({
      id: 42,
      topic: 'order.status_changed',
      payload: { orderId: 'o-1', from: 'packing', to: 'out_for_delivery', code: '4821', providerPaymentId: 'pay_123', address: { line1: 'x' } },
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    expect(event.key).toBe('o-1');
    expect(event.value).toEqual({
      eventId: 42,
      type: 'order.status_changed',
      occurredAt: '2026-01-01T00:00:00.000Z',
      data: { orderId: 'o-1', from: 'packing', to: 'out_for_delivery' },
    });
    expect(JSON.stringify(event)).not.toContain('4821');
    expect(JSON.stringify(event)).not.toContain('pay_123');
  });
});

describe('analytics helpers', () => {
  it('normalises queries so variants count as one unmet need', () => {
    expect(normaliseQuery('  ESP32-CAM  Module!! ')).toBe('esp32-cam module');
    expect(normaliseQuery('Raspberry   Pi 5')).toBe(normaliseQuery('raspberry pi 5'));
  });

  it('keeps the newest products first without duplicates', () => {
    const merged = mergeShown(
      [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      [{ id: 'c', name: 'C' }, { id: 'a', name: 'A2' }],
    );
    expect(merged.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
});
