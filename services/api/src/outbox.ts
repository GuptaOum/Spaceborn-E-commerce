import type { Db } from './db/pool.js';

export type OutboxTopic =
  | 'order.placed'
  | 'order.status_changed'
  | 'refund.requested'
  | 'fab_job.submitted'
  | 'fab_job.paid'
  | 'fab_job.status_changed';

export async function enqueue(db: Db, topic: OutboxTopic, payload: Record<string, unknown>) {
  await db.query('insert into outbox (topic, payload) values ($1, $2)', [topic, JSON.stringify(payload)]);
}
