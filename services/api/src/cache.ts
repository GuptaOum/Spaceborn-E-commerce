import { createClient, type RedisClientType } from 'redis';
import { config } from './config.js';
import { logger } from './logger.js';

// Shared cache for read-heavy public data. Postgres stays the source of truth: a miss, a
// connection error, or no REDIS_URL at all just serves the query. Checkout never reads this.
let client: RedisClientType | null = null;
let connecting: Promise<void> | null = null;

export async function connectCache() {
  const url = config.REDIS_URL;
  if (!url || client?.isOpen) return;
  if (connecting) return connecting;
  connecting = (async () => {
    if (client) {
      const stale = client;
      client = null;
      await stale.disconnect().catch(() => undefined);
    }
    const next = createClient({
      url,
      socket: {
        connectTimeout: 2000,
        // A few tries, then give up so a later call can start a fresh client. Returning an Error stops the loop.
        reconnectStrategy: (retries) => (retries > 3 ? new Error('redis unavailable') : retries * 200),
      },
    });
    next.on('error', (err) => logger.warn({ err }, 'redis error'));
    try {
      await next.connect();
      client = next as RedisClientType;
      logger.info('redis connected');
    } catch (err) {
      logger.warn({ err }, 'redis unavailable, catalog is served from postgres');
      await next.disconnect().catch(() => undefined);
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export async function closeCache() {
  const current = client;
  const sub = subscriber;
  client = null;
  subscriber = null;
  await sub?.quit().catch(() => undefined);
  await current?.quit().catch(() => undefined);
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  if (!client) return undefined;
  try {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch (err) {
    logger.warn({ err, key }, 'redis get failed');
    return undefined;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    logger.warn({ err, key }, 'redis set failed');
  }
}

/** Increments a counter that expires `ttlSeconds` after its first hit. Undefined when Redis is unavailable. */
export async function cacheIncr(key: string, ttlSeconds: number): Promise<number | undefined> {
  if (!client) return undefined;
  try {
    const [count] = await client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
    return Number(count);
  } catch (err) {
    logger.warn({ err, key }, 'redis incr failed');
    return undefined;
  }
}

/** Pushes a raw message onto a list. Throws when Redis is unavailable so the caller can retry. */
export async function listPush(key: string, value: string) {
  if (!client?.isOpen) await connectCache();
  const current = client;
  if (!current?.isOpen) throw new Error('redis is not connected');
  await current.lPush(key, value);
}

export const cacheConnected = () => client !== null;

// Pub/sub for live delivery tracking. A subscriber connection cannot run commands, so it is a
// separate client, opened the first time a stream asks for one. Without Redis, publishers return
// false and callers fall back to delivering the event inside their own process.
let subscriber: RedisClientType | null = null;
let subscriberConnecting: Promise<RedisClientType | null> | null = null;

async function getSubscriber(): Promise<RedisClientType | null> {
  if (subscriber?.isOpen) return subscriber;
  if (!client?.isOpen) return null;
  if (subscriberConnecting) return subscriberConnecting;
  subscriberConnecting = (async () => {
    const next = client!.duplicate();
    next.on('error', (err) => logger.warn({ err }, 'redis subscriber error'));
    try {
      await next.connect();
      subscriber = next as RedisClientType;
      return subscriber;
    } catch (err) {
      logger.warn({ err }, 'redis subscriber unavailable');
      await next.disconnect().catch(() => undefined);
      return null;
    } finally {
      subscriberConnecting = null;
    }
  })();
  return subscriberConnecting;
}

/** True when the message reached Redis, so every API task's subscribers will see it. */
export async function cachePublish(channel: string, message: string): Promise<boolean> {
  if (!client?.isOpen) return false;
  try {
    await client.publish(channel, message);
    return true;
  } catch (err) {
    logger.warn({ err, channel }, 'redis publish failed');
    return false;
  }
}

/** Subscribes through Redis when it is available. Resolves to an unsubscribe function, or null without Redis. */
export async function cacheSubscribe(channel: string, handler: (message: string) => void): Promise<(() => Promise<void>) | null> {
  const sub = await getSubscriber();
  if (!sub) return null;
  try {
    await sub.subscribe(channel, handler);
  } catch (err) {
    logger.warn({ err, channel }, 'redis subscribe failed');
    return null;
  }
  return async () => {
    await sub.unsubscribe(channel, handler).catch(() => undefined);
  };
}

// One counter for the whole catalog. Writers increment it; readers put it in the key, so a
// stock or product edit drops every cached page without scanning keys.
export async function catalogGeneration(): Promise<string> {
  if (!client) return '0';
  try {
    return (await client.get('catalog:gen')) ?? '0';
  } catch {
    return '0';
  }
}

export async function bumpCatalog() {
  if (!client) return;
  try {
    await client.incr('catalog:gen');
  } catch (err) {
    logger.warn({ err }, 'redis catalog bump failed');
  }
}
