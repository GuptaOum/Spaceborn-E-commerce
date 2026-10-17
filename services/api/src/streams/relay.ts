import { withTransaction } from '../db/pool.js';
import { publish, TOPICS } from './kafka.js';

// Only identifiers and state changes leave the database. Payloads also carry handover OTPs and
// provider payment ids, which have no business in an analytics stream.
const STREAMED_FIELDS = ['orderId', 'jobId', 'storeId', 'checkoutId', 'paymentId', 'from', 'to', 'amountPaise'] as const;

export function domainEvent(row: { id: number; topic: string; payload: Record<string, unknown>; created_at: Date }) {
  const data: Record<string, unknown> = {};
  for (const field of STREAMED_FIELDS) if (row.payload[field] !== undefined) data[field] = row.payload[field];
  const aggregate = (row.payload.orderId ?? row.payload.jobId ?? row.payload.paymentId ?? row.id) as string | number;
  return {
    // Keyed by the order/job so every event of one aggregate lands on one partition, in order.
    key: String(aggregate),
    value: { eventId: row.id, type: row.topic, occurredAt: row.created_at.toISOString(), data },
    headers: { 'event-type': row.topic },
  };
}

/**
 * Transactional outbox -> Kafka. Rows are locked, published with acks from all replicas, then marked;
 * a crash in between re-sends them, so consumers dedupe on eventId (at-least-once delivery).
 */
export async function relayOutbox(batchSize = 200): Promise<number> {
  return withTransaction(async (c) => {
    const { rows } = await c.query<{ id: number; topic: string; payload: Record<string, unknown>; created_at: Date }>(
      `select id, topic, payload, created_at from outbox
        where streamed_at is null
        order by id
        limit $1
        for update skip locked`,
      [batchSize],
    );
    if (rows.length === 0) return 0;
    await publish(TOPICS.domain, rows.map(domainEvent));
    await c.query('update outbox set streamed_at = now() where id = any($1::bigint[])', [rows.map((r) => r.id)]);
    return rows.length;
  });
}
