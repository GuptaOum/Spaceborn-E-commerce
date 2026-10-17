import { Kafka, logLevel, Partitioners, type Producer } from 'kafkajs';
import { config } from '../config.js';
import { logger } from '../logger.js';

export const TOPICS = {
  /** Every committed outbox event, relayed in order per aggregate (order or job id). */
  domain: `${config.KAFKA_TOPIC_PREFIX}.domain-events`,
  /** Copilot usage: tool calls, zero-result searches, token counts, latency. */
  ai: `${config.KAFKA_TOPIC_PREFIX}.ai-events`,
} as const;

export interface StreamMessage {
  key: string;
  value: Record<string, unknown>;
  headers?: Record<string, string>;
}

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let connecting: Promise<Producer> | null = null;

export const kafkaEnabled = () => Boolean(config.KAFKA_BROKERS);

export function kafkaClient(clientId: string): Kafka {
  if (!config.KAFKA_BROKERS) throw new Error('KAFKA_BROKERS is not set');
  return new Kafka({
    clientId,
    brokers: config.KAFKA_BROKERS.split(',').map((b) => b.trim()).filter(Boolean),
    connectionTimeout: 3000,
    requestTimeout: 10_000,
    retry: { retries: 3, initialRetryTime: 300 },
    logLevel: logLevel.WARN,
    logCreator: () => ({ namespace, label, log }) => logger.warn({ namespace, kafka: label, ...log }, 'kafka'),
  });
}

async function getProducer(): Promise<Producer> {
  if (producer) return producer;
  connecting ??= (async () => {
    kafka ??= kafkaClient('spaceborn-api');
    // Idempotent: a retried send after a lost ack is written once per partition.
    const next = kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1,
      allowAutoTopicCreation: true,
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    try {
      await next.connect();
    } catch (err) {
      connecting = null;
      throw err;
    }
    next.on('producer.disconnect', () => {
      producer = null;
      connecting = null;
    });
    producer = next;
    return next;
  })();
  return connecting;
}

/** Creates the topics if they are missing, so a consumer can subscribe before anything was produced. */
export async function ensureTopics(client: Kafka, numPartitions = 3) {
  const admin = client.admin();
  await admin.connect();
  try {
    await admin.createTopics({ waitForLeaders: true, topics: Object.values(TOPICS).map((topic) => ({ topic, numPartitions })) });
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
}

/** Sends and waits for the broker's ack. Throws so the caller (the outbox relay) can retry. */
export async function publish(topic: string, messages: StreamMessage[]) {
  if (messages.length === 0) return;
  const p = await getProducer();
  await p.send({
    topic,
    acks: -1,
    messages: messages.map((m) => ({ key: m.key, value: JSON.stringify(m.value), headers: m.headers })),
  });
}

/** Analytics events: losing one is acceptable, slowing down a customer request is not. */
export function publishInBackground(topic: string, message: StreamMessage) {
  if (!kafkaEnabled()) return;
  publish(topic, [message]).catch((err) => logger.warn({ err, topic }, 'kafka publish failed, event dropped'));
}

export async function closeKafka() {
  const p = producer;
  producer = null;
  connecting = null;
  await p?.disconnect().catch(() => undefined);
}
