import { config } from './config.js';
import { pool, withTransaction } from './db/pool.js';
import { logger } from './logger.js';
import { expireQuotes, removeOrphanFiles } from './fabrication/service.js';
import { expireReservations } from './orders/service.js';
import { refundPayment } from './payments/razorpay.js';

const POLL_MS = 3_000;
const MAX_ATTEMPTS = 8;

interface OutboxRow {
  id: number;
  topic: string;
  payload: Record<string, unknown>;
  attempts: number;
}

async function handle(row: OutboxRow) {
  switch (row.topic) {
    case 'refund.requested': {
      const { paymentId, orderId, jobId, providerPaymentId, amountPaise } = row.payload as {
        paymentId: string;
        orderId?: string;
        jobId?: string;
        providerPaymentId: string;
        amountPaise: number;
      };
      const current = await pool.query<{ status: string }>('select status from payments where id = $1', [paymentId]);
      if (current.rows[0]?.status !== 'refund_pending') return;
      if (config.paymentsMode === 'razorpay') {
        await refundPayment(providerPaymentId, amountPaise, (orderId ?? jobId)!);
      }
      await pool.query(`update payments set status = 'refunded' where id = $1 and status = 'refund_pending'`, [paymentId]);
      logger.info({ orderId, jobId, amountPaise }, 'refund issued');
      return;
    }
    case 'fab_job.submitted':
    case 'fab_job.paid':
    case 'fab_job.status_changed':
      logger.info({ topic: row.topic, ...row.payload }, 'fabrication job event');
      return;
    case 'order.placed':
      // Hook for vendor push notifications / rider dispatch.
      logger.info({ orderId: row.payload.orderId }, 'new order for store');
      return;
    case 'order.status_changed':
      logger.info(row.payload, 'order status changed');
      return;
    default:
      logger.warn({ topic: row.topic }, 'unknown outbox topic');
  }
}

async function drainOutbox(batchSize = 20): Promise<number> {
  return withTransaction(async (c) => {
    const { rows } = await c.query<OutboxRow>(
      `select id, topic, payload, attempts from outbox
        where processed_at is null and failed_at is null and next_attempt_at <= now()
        order by id
        limit $1
        for update skip locked`,
      [batchSize],
    );
    for (const row of rows) {
      try {
        await handle(row);
        await c.query('update outbox set processed_at = now() where id = $1', [row.id]);
      } catch (err) {
        const attempts = row.attempts + 1;
        const giveUp = attempts >= MAX_ATTEMPTS;
        logger.error({ err, id: row.id, topic: row.topic, attempts }, giveUp ? 'outbox event failed permanently' : 'outbox event failed');
        await c.query(
          `update outbox set attempts = $2, last_error = $3,
                  next_attempt_at = now() + make_interval(secs => power(2, $2)::int * 5),
                  failed_at = case when $4 then now() else null end
            where id = $1`,
          [row.id, attempts, String((err as Error).message ?? err).slice(0, 1000), giveUp],
        );
      }
    }
    return rows.length;
  });
}

let running = true;
const ORPHAN_SWEEP_MS = 60 * 60_000;
let lastOrphanSweep = 0;

async function loop() {
  logger.info({ payments: config.paymentsMode }, 'worker started');
  while (running) {
    try {
      const expired = await expireReservations();
      if (expired) logger.info({ expired }, 'released stock from unpaid orders');
      const expiredQuotes = await expireQuotes();
      if (expiredQuotes) logger.info({ expiredQuotes }, 'expired unaccepted fabrication quotes');
      if (Date.now() - lastOrphanSweep > ORPHAN_SWEEP_MS) {
        lastOrphanSweep = Date.now();
        const removed = await removeOrphanFiles();
        if (removed) logger.info({ removed }, 'removed unattached uploads');
      }
      const processed = await drainOutbox();
      if (processed === 0 && expired === 0 && expiredQuotes === 0) await new Promise((r) => setTimeout(r, POLL_MS));
    } catch (err) {
      logger.error({ err }, 'worker iteration failed');
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  await pool.end();
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    logger.info({ signal }, 'worker stopping');
    running = false;
  });
}

loop();
