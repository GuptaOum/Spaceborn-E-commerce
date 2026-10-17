import { config } from './config.js';
import { pool, withTransaction } from './db/pool.js';
import { logger } from './logger.js';
import { applyRecord, pruneInbox } from './streams/analytics.js';
import { ensureTopics, kafkaClient, TOPICS } from './streams/kafka.js';

// Materialises the Kafka streams into small Postgres tables for the admin insights page. A separate
// consumer group can be added later and replay both topics from the beginning without touching this one.
const GROUP = 'spaceborn-analytics';
const PRUNE_EVERY_MS = 60 * 60 * 1000;

if (!config.KAFKA_BROKERS) {
  logger.error('KAFKA_BROKERS is not set; the analytics consumer has nothing to read');
  process.exit(1);
}

const client = kafkaClient('spaceborn-analytics');
const consumer = client.consumer({ groupId: GROUP, sessionTimeout: 30_000 });
let stopping = false;

// kafkajs restarts itself after retriable errors; anything else leaves a consumer that reads nothing,
// so the process exits and ECS starts a fresh one.
consumer.on(consumer.events.CRASH, ({ payload }) => {
  if (stopping || payload.restart) return;
  logger.error({ err: payload.error }, 'analytics consumer crashed without restart');
  process.exit(1);
});

async function main() {
  await ensureTopics(client);
  await consumer.connect();
  await consumer.subscribe({ topics: [TOPICS.ai, TOPICS.domain], fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let value: Record<string, unknown>;
      try {
        value = JSON.parse(message.value?.toString() ?? 'null');
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
      } catch (err) {
        // A poison message is logged and skipped; blocking the partition on it would stall every later event.
        logger.warn({ err, topic, partition, offset: message.offset }, 'unreadable stream message skipped');
        return;
      }
      await withTransaction((c) => applyRecord(c, GROUP, { topic, partition, offset: message.offset, value }, TOPICS));
    },
  });
  logger.info({ topics: [TOPICS.ai, TOPICS.domain], group: GROUP }, 'analytics consumer running');
}

const pruner = setInterval(() => {
  pruneInbox(pool, GROUP)
    .then((n) => n && logger.info({ removed: n }, 'stream inbox pruned'))
    .catch((err) => logger.warn({ err }, 'stream inbox prune failed'));
}, PRUNE_EVERY_MS);

async function stop(signal: string) {
  stopping = true;
  logger.info({ signal }, 'analytics consumer stopping');
  clearInterval(pruner);
  await consumer.disconnect().catch(() => undefined);
  await pool.end().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void stop('SIGTERM'));
process.on('SIGINT', () => void stop('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'analytics consumer failed to start');
  process.exit(1);
});
