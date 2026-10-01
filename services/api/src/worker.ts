import { backfillProductEmbeddings } from './catalog/search.js';
import { config } from './config.js';
import { pool, withTransaction } from './db/pool.js';
import { logger } from './logger.js';
import { expireQuotes, removeOrphanFiles } from './fabrication/service.js';
import { notifyJobStatus, notifyJobSubmitted, notifyOrderPlaced, notifyOrderStatus } from './notifications.js';
import { expireReservations } from './orders/service.js';
import type { OrderStatus } from './orders/status.js';
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
      await notifyJobSubmitted(row.payload.jobId as string);
      return;
    case 'fab_job.paid':
      await notifyJobStatus(row.payload.jobId as string, 'in_production');
      return;
    case 'fab_job.status_changed':
      await notifyJobStatus(row.payload.jobId as string, row.payload.to as string);
      return;
    case 'order.placed':
      await notifyOrderPlaced(row.payload.orderId as string);
      return;
    case 'order.status_changed':
      await notifyOrderStatus(row.payload.orderId as string, row.payload.to as OrderStatus);
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
// New or edited catalog products get their search vector within about a minute.
const EMBED_SWEEP_MS = 60_000;
let lastEmbedSweep = 0;

async function loop() {
  logger.info({ payments: config.paymentsMode, mail: config.MAIL_PROVIDER }, 'worker started');
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
      if (Date.now() - lastEmbedSweep > EMBED_SWEEP_MS) {
        lastEmbedSweep = Date.now();
        const embedded = await backfillProductEmbeddings();
        if (embedded) logger.info({ embedded }, 'embedded catalog products for search');
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
