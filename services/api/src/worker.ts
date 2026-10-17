import { closeCache, connectCache } from './cache.js';
import { backfillProductEmbeddings } from './catalog/search.js';
import { config } from './config.js';
import { sendCeleryTask } from './streams/celery.js';
import { closeKafka, kafkaEnabled } from './streams/kafka.js';
import { relayOutbox } from './streams/relay.js';
import { pool, withTransaction } from './db/pool.js';
import { logger } from './logger.js';
import { expireQuotes, removeOrphanFiles } from './fabrication/service.js';
import { notifyHandoverOtp, notifyJobStatus, notifyJobSubmitted, notifyOrderPlaced, notifyOrderStatus } from './notifications.js';
import { cancelUnaccepted, expireReservations } from './orders/service.js';
import type { OrderStatus } from './orders/status.js';
import { refundPayment } from './payments/razorpay.js';
import { recordRefund, refundOwed, settleRefundStatus, type RefundRequest } from './payments/refunds.js';

const POLL_MS = 3_000;
const MAX_ATTEMPTS = 8;
const CAD_TASK = 'spaceborn.analyze_cad_file';

interface OutboxRow {
  id: number;
  topic: string;
  payload: Record<string, unknown>;
  attempts: number;
}

async function handle(row: OutboxRow) {
  switch (row.topic) {
    case 'refund.requested': {
      const request = row.payload as unknown as RefundRequest;
      const { reference, amount } = await refundOwed(pool, request);
      if (amount <= 0) {
        await settleRefundStatus(pool, request.paymentId);
        return;
      }
      let providerRefundId: string | null = null;
      if (config.paymentsMode === 'razorpay') {
        if (!request.providerPaymentId) throw new Error(`payment ${request.paymentId} has no provider payment id to refund`);
        providerRefundId = (await refundPayment(request.providerPaymentId, amount, reference)).id ?? null;
      }
      await recordRefund(pool, request.paymentId, reference, amount, providerRefundId);
      logger.info({ orderId: request.orderId, jobId: request.jobId, amountPaise: amount }, 'refund issued');
      return;
    }
    case 'fab_job.submitted':
      await notifyJobSubmitted(row.payload.jobId as string);
      return;
    case 'fab_job.analyze': {
      if (!config.CAD_ANALYSIS_ENABLED) return;
      const files = await pool.query<{ id: string }>(
        `select f.id from fab_files f
          where f.job_id = $1 and not exists (select 1 from fab_file_analysis a where a.file_id = f.id)
          order by f.created_at`,
        [row.payload.jobId],
      );
      // A retry after a partial send repeats some tasks; the worker's upsert makes that harmless.
      for (const file of files.rows) await sendCeleryTask(CAD_TASK, [file.id], config.CELERY_CAD_QUEUE);
      return;
    }
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
    case 'order.handover_otp':
      await notifyHandoverOtp(row.payload.orderId as string, String(row.payload.code ?? ''));
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
                  next_attempt_at = now() + make_interval(secs => (power(2::float8, $2::float8) * 5)::int),
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

// Kafka being down must not hold up refunds and emails, so the relay backs off on its own clock.
const RELAY_BACKOFF_MS = 30_000;
let relayPausedUntil = 0;

async function relay(): Promise<number> {
  if (!kafkaEnabled() || Date.now() < relayPausedUntil) return 0;
  try {
    return await relayOutbox();
  } catch (err) {
    relayPausedUntil = Date.now() + RELAY_BACKOFF_MS;
    logger.warn({ err }, 'outbox relay to kafka failed, retrying in 30s');
    return 0;
  }
}

async function loop() {
  await connectCache();
  logger.info(
    { payments: config.paymentsMode, mail: config.MAIL_PROVIDER, kafka: kafkaEnabled(), cad: config.CAD_ANALYSIS_ENABLED },
    'worker started',
  );
  while (running) {
    try {
      const expired = await expireReservations();
      if (expired) logger.info({ expired }, 'released stock from unpaid orders');
      const expiredQuotes = await expireQuotes();
      if (expiredQuotes) logger.info({ expiredQuotes }, 'expired unaccepted fabrication quotes');
      const unaccepted = await cancelUnaccepted();
      if (unaccepted) logger.info({ unaccepted }, 'cancelled paid orders no shop accepted in time');
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
      const streamed = await relay();
      if (processed === 0 && streamed === 0 && expired === 0 && expiredQuotes === 0) await new Promise((r) => setTimeout(r, POLL_MS));
    } catch (err) {
      logger.error({ err }, 'worker iteration failed');
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  await closeKafka();
  await closeCache();
  await pool.end();
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    logger.info({ signal }, 'worker stopping');
    running = false;
  });
}

loop();
