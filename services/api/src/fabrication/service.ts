import crypto from 'node:crypto';
import path from 'node:path';
import type pg from 'pg';
import { config } from '../config.js';
import { pool, withTransaction, type Db } from '../db/pool.js';
import { conflict, forbidden, HttpError, notFound, unprocessable } from '../errors.js';
import { haversineKm } from '../lib/geo.js';
import { logger } from '../logger.js';
import { enqueue } from '../outbox.js';
import type { ActorContext, DeliveryAddress } from '../orders/service.js';
import { deliveryFee, PLATFORM_FEE, toPaise } from '../orders/pricing.js';
import { createProviderOrder } from '../payments/razorpay.js';
import { storage } from '../storage.js';
import { canTransitionJob, FAB_PAID_STATUSES, FAB_PRE_PAYMENT, type FabStatus } from './status.js';

export const QUOTE_VALID_HOURS = 48;
export const MAX_FILES_PER_JOB = 10;
export const ALLOWED_EXTENSIONS = ['.stl', '.obj', '.3mf', '.step', '.stp', '.iges', '.igs', '.dxf', '.svg', '.gcode', '.nc', '.pdf'];

const round2 = (n: number) => Math.round(n * 100) / 100;

const JOB_SELECT = `
  select j.id, j.job_number as "jobNumber", j.customer_id as "customerId", j.listing_id as "listingId",
         j.store_id as "storeId", s.name as "storeName", s.phone as "storePhone", j.kind, j.material, j.quantity,
         j.notes, j.status, j.quote_amount as "quoteAmount", j.quote_note as "quoteNote",
         j.ready_in_hours as "readyInHours", j.quote_expires_at as "quoteExpiresAt", j.delivery_fee as "deliveryFee",
         j.platform_fee as "platformFee", j.grand_total as "grandTotal", j.delivery_address as "deliveryAddress",
         j.distance_km as "distanceKm", j.handover_otp as "handoverOtp", j.close_reason as "closeReason",
         j.quoted_at as "quotedAt", j.paid_at as "paidAt", j.delivered_at as "deliveredAt", j.created_at as "createdAt",
         p.status as "paymentStatus",
         coalesce((
           select json_agg(json_build_object('id', f.id, 'fileName', f.file_name, 'sizeBytes', f.size_bytes) order by f.created_at)
             from fab_files f where f.job_id = j.id
         ), '[]'::json) as files
    from fab_jobs j
    join stores s on s.id = j.store_id
    left join payments p on p.fab_job_id = j.id`;

export type JobView = Record<string, unknown> & {
  id: string;
  status: FabStatus;
  customerId: string;
  storeId: string;
  handoverOtp?: string;
  deliveryAddress: DeliveryAddress;
};

// Vendors only see the full address once the customer has paid and the job is theirs to deliver.
function forViewer(job: JobView, viewer: ActorContext): JobView {
  if (viewer.role === 'customer') return job;
  const { handoverOtp: _otp, ...rest } = job;
  if (viewer.role === 'vendor' && FAB_PRE_PAYMENT.includes(job.status)) {
    const { city, pincode } = job.deliveryAddress;
    return { ...rest, deliveryAddress: { city, pincode } } as unknown as JobView;
  }
  return rest as JobView;
}

function canView(job: JobView, viewer: ActorContext) {
  if (viewer.role === 'admin' || viewer.role === 'system') return true;
  if (viewer.role === 'vendor') return job.storeId === viewer.storeId;
  return job.customerId === viewer.uid;
}

export async function getJob(db: Db, jobId: string, viewer: ActorContext): Promise<JobView> {
  const { rows } = await db.query<JobView>(`${JOB_SELECT} where j.id = $1`, [jobId]);
  const job = rows[0];
  if (!job || !canView(job, viewer)) throw notFound('Job not found');
  const history = await db.query(
    `select from_status as "from", to_status as "to", actor_role as "actorRole", note, created_at as "at"
       from fab_job_history where job_id = $1 order by created_at`,
    [jobId],
  );
  return forViewer({ ...job, history: history.rows }, viewer);
}

export async function listCustomerJobs(customerId: string, limit: number) {
  const { rows } = await pool.query<JobView>(`${JOB_SELECT} where j.customer_id = $1 order by j.created_at desc limit $2`, [
    customerId,
    limit,
  ]);
  return rows;
}

export async function listStoreJobs(storeId: string, statuses: FabStatus[] | null, limit: number) {
  const { rows } = await pool.query<JobView>(
    `${JOB_SELECT} where j.store_id = $1 and ($2::fab_job_status[] is null or j.status = any($2))
      order by j.created_at desc limit $3`,
    [storeId, statuses, limit],
  );
  return rows.map((j) => forViewer(j, { role: 'vendor', uid: null, storeId }));
}

/** `cities` is an admin's lower-cased region list; null means every city. */
export async function listAllJobs(statuses: FabStatus[] | null, limit: number, cities: string[] | null = null) {
  const { rows } = await pool.query<JobView>(
    `${JOB_SELECT}
      where ($1::fab_job_status[] is null or j.status = any($1))
        and ($3::text[] is null or lower(btrim(s.city)) = any($3))
      order by j.created_at desc limit $2`,
    [statuses, limit, cities],
  );
  return rows.map((j) => forViewer(j, { role: 'admin', uid: null }));
}

/** The city a job's store sits in, or null when the job does not exist. */
export async function jobCity(jobId: string): Promise<string | null> {
  const { rows } = await pool.query<{ city: string }>(
    'select s.city from fab_jobs j join stores s on s.id = j.store_id where j.id = $1',
    [jobId],
  );
  return rows[0]?.city ?? null;
}

async function recordStatus(db: Db, jobId: string, from: FabStatus | null, to: FabStatus, actor: ActorContext, note?: string) {
  await db.query(
    `insert into fab_job_history (job_id, from_status, to_status, actor_id, actor_role, note) values ($1, $2, $3, $4, $5, $6)`,
    [jobId, from, to, actor.uid, actor.role, note ?? null],
  );
}

export function sanitizeFileName(raw: string) {
  const base = path.basename(raw.replace(/\\/g, '/')).normalize('NFKC');
  const cleaned = base.replace(/[^\w.\- ()]/g, '_').replace(/\s+/g, ' ').trim().slice(-120);
  return cleaned || 'design';
}

export async function saveUpload(ownerId: string, rawName: string, body: Buffer) {
  const fileName = sanitizeFileName(rawName);
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw unprocessable('file_type', `Allowed file types: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  if (body.length === 0) throw unprocessable('file_empty', 'The file is empty');

  const key = `fab/${ownerId.replace(/[^\w-]/g, '_')}/${crypto.randomUUID()}${ext}`;
  await storage.put(key, body);
  const { rows } = await pool.query(
    `insert into fab_files (owner_id, storage_key, file_name, size_bytes) values ($1, $2, $3, $4)
     returning id, file_name as "fileName", size_bytes as "sizeBytes"`,
    [ownerId, key, fileName, body.length],
  );
  return rows[0] as { id: string; fileName: string; sizeBytes: number };
}

export async function getJobFile(jobId: string, fileId: string, viewer: ActorContext) {
  const { rows } = await pool.query<{ storage_key: string; file_name: string; customer_id: string; store_id: string }>(
    `select f.storage_key, f.file_name, j.customer_id, j.store_id
       from fab_files f join fab_jobs j on j.id = f.job_id
      where f.id = $1 and j.id = $2`,
    [fileId, jobId],
  );
  const file = rows[0];
  const allowed =
    file &&
    (viewer.role === 'admin' ||
      (viewer.role === 'vendor' && file.store_id === viewer.storeId) ||
      (viewer.role === 'customer' && file.customer_id === viewer.uid));
  if (!allowed) throw notFound('File not found');
  return { key: file.storage_key, fileName: file.file_name };
}

export interface CreateJobInput {
  customerId: string;
  listingId: string;
  material: string;
  quantity: number;
  notes: string;
  fileIds: string[];
  address: DeliveryAddress;
}

export async function createJob(input: CreateJobInput) {
  const jobId = await withTransaction(async (c) => {
    const { rows } = await c.query(
      `select l.id, l.store_id, l.kind, l.materials, s.latitude, s.longitude, s.delivery_radius_km
         from service_listings l join stores s on s.id = l.store_id
        where l.id = $1 and l.status = 'approved' and l.is_active and s.status = 'approved'
        for share of l, s`,
      [input.listingId],
    );
    const listing = rows[0];
    if (!listing) throw unprocessable('service_unavailable', 'This service is not taking jobs right now');
    if (!(listing.materials as string[]).includes(input.material)) {
      throw unprocessable('material_unavailable', 'This material is not offered by the service');
    }
    const distanceKm = haversineKm(input.address.latitude, input.address.longitude, listing.latitude, listing.longitude);
    if (distanceKm > Number(listing.delivery_radius_km)) {
      throw unprocessable('out_of_range', 'This service does not deliver to your address');
    }

    const inserted = await c.query<{ id: string }>(
      `insert into fab_jobs (customer_id, listing_id, store_id, kind, material, quantity, notes, delivery_address, distance_km, handover_otp)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [input.customerId, listing.id, listing.store_id, listing.kind, input.material, input.quantity, input.notes,
        JSON.stringify(input.address), round2(distanceKm), crypto.randomInt(1000, 10000).toString()],
    );
    const id = inserted.rows[0]!.id;

    const attached = await c.query(
      `update fab_files set job_id = $1 where id = any($2::uuid[]) and owner_id = $3 and job_id is null returning id`,
      [id, input.fileIds, input.customerId],
    );
    if (attached.rowCount !== new Set(input.fileIds).size) {
      throw conflict('One or more files are missing or already attached to another job');
    }
    await recordStatus(c, id, null, 'submitted', { role: 'customer', uid: input.customerId });
    await enqueue(c, 'fab_job.submitted', { jobId: id, storeId: listing.store_id });
    return id;
  });
  return getJob(pool, jobId, { role: 'customer', uid: input.customerId });
}

export interface QuoteInput {
  jobId: string;
  vendor: ActorContext;
  amount: number;
  note?: string;
  readyInHours: number;
}

export async function quoteJob(input: QuoteInput) {
  await withTransaction(async (c) => {
    const { rows } = await c.query('select id, status, store_id from fab_jobs where id = $1 for update', [input.jobId]);
    const job = rows[0];
    if (!job || job.store_id !== input.vendor.storeId) throw notFound('Job not found');
    if (!canTransitionJob(job.status, 'quoted', 'vendor')) throw conflict(`A ${job.status} job cannot be quoted`);
    await c.query(
      `update fab_jobs set status = 'quoted', quote_amount = $2, quote_note = $3, ready_in_hours = $4,
              quoted_at = now(), quote_expires_at = now() + make_interval(hours => $5)
        where id = $1`,
      [job.id, input.amount, input.note ?? null, input.readyInHours, QUOTE_VALID_HOURS],
    );
    await recordStatus(c, job.id, job.status, 'quoted', input.vendor, `Quoted ₹${input.amount}`);
    await enqueue(c, 'fab_job.status_changed', { jobId: job.id, from: job.status, to: 'quoted' });
  });
  return getJob(pool, input.jobId, input.vendor);
}

async function jobPayment(jobId: string) {
  const { rows } = await pool.query(
    `select provider, provider_order_id as "providerOrderId", amount_paise as "amountPaise", status
       from payments where fab_job_id = $1`,
    [jobId],
  );
  const payment = rows[0];
  return (
    payment && { ...payment, currency: 'INR', keyId: payment.provider === 'razorpay' ? (config.RAZORPAY_KEY_ID ?? null) : null }
  );
}

export async function acceptQuote(jobId: string, customerId: string) {
  const customer: ActorContext = { role: 'customer', uid: customerId };
  const grandTotal = await withTransaction(async (c) => {
    const { rows } = await c.query(
      `select id, status, customer_id, quote_amount, distance_km, grand_total, quote_expires_at < now() as expired
         from fab_jobs where id = $1 for update`,
      [jobId],
    );
    const job = rows[0];
    if (!job || job.customer_id !== customerId) throw notFound('Job not found');
    if (job.status === 'pending_payment') return Number(job.grand_total);
    if (!canTransitionJob(job.status, 'pending_payment', 'customer')) throw conflict(`A ${job.status} job cannot be accepted`);
    if (job.expired) throw conflict('This quote has expired. Ask the vendor for a new quote.');

    const quote = Number(job.quote_amount);
    const fee = deliveryFee(quote, Number(job.distance_km));
    const total = round2(quote + fee + PLATFORM_FEE);
    await c.query(
      `update fab_jobs set status = 'pending_payment', delivery_fee = $2, platform_fee = $3, grand_total = $4 where id = $1`,
      [job.id, fee, PLATFORM_FEE, total],
    );
    await recordStatus(c, job.id, job.status, 'pending_payment', customer, 'Quote accepted');
    return total;
  });

  if (!(await jobPayment(jobId))) {
    try {
      const amountPaise = toPaise(grandTotal);
      const providerOrderId =
        config.paymentsMode === 'razorpay' ? (await createProviderOrder(jobId, amountPaise)).providerOrderId : `mock_fab_${jobId}`;
      await pool.query(
        `insert into payments (fab_job_id, provider, provider_order_id, amount_paise) values ($1, $2, $3, $4)
         on conflict (fab_job_id) do nothing`,
        [jobId, config.paymentsMode, providerOrderId, amountPaise],
      );
    } catch (err) {
      logger.error({ err, jobId }, 'could not create payment for fabrication job');
      throw new HttpError(502, 'payment_unavailable', 'Payments are temporarily unavailable. Please try again.');
    }
  }
  return { job: await getJob(pool, jobId, customer), payment: await jobPayment(jobId) };
}

export async function markFabPaid(c: pg.PoolClient, jobId: string, paymentId: string, providerPaymentId: string, amountPaise: number) {
  const { rows } = await c.query('select status from fab_jobs where id = $1', [jobId]);
  const status = rows[0]?.status as FabStatus;
  const system: ActorContext = { role: 'system', uid: null };

  if (status === 'pending_payment') {
    await c.query(`update payments set status = 'captured', provider_payment_id = $2 where id = $1`, [paymentId, providerPaymentId]);
    await c.query(`update fab_jobs set status = 'in_production', paid_at = now(), quote_expires_at = null where id = $1`, [jobId]);
    await recordStatus(c, jobId, 'pending_payment', 'in_production', system, 'Payment received');
    await enqueue(c, 'fab_job.paid', { jobId });
    return;
  }
  await c.query(`update payments set status = 'refund_pending', provider_payment_id = $2 where id = $1`, [paymentId, providerPaymentId]);
  await enqueue(c, 'refund.requested', { paymentId, jobId, providerPaymentId, amountPaise });
  logger.warn({ jobId, status }, 'payment captured for inactive fabrication job, refund queued');
}

export interface JobTransitionInput {
  jobId: string;
  to: FabStatus;
  actor: ActorContext;
  reason?: string;
  otp?: string;
}

export async function transitionJob(input: JobTransitionInput) {
  await withTransaction(async (c) => {
    const { rows } = await c.query(
      `select j.id, j.status, j.customer_id, j.store_id, j.handover_otp,
              p.id as payment_id, p.status as payment_status, p.provider_payment_id, p.amount_paise
         from fab_jobs j left join payments p on p.fab_job_id = j.id
        where j.id = $1
        for update of j`,
      [input.jobId],
    );
    const job = rows[0];
    const { actor } = input;
    if (!job) throw notFound('Job not found');
    if (actor.role === 'customer' && job.customer_id !== actor.uid) throw notFound('Job not found');
    if (actor.role === 'vendor' && job.store_id !== actor.storeId) throw notFound('Job not found');

    const from = job.status as FabStatus;
    if (!canTransitionJob(from, input.to, actor.role)) throw conflict(`Job cannot move from ${from} to ${input.to}`);
    if (input.to === 'delivered') {
      const otp = input.otp ?? '';
      const matches = otp.length === job.handover_otp.length && crypto.timingSafeEqual(Buffer.from(otp), Buffer.from(job.handover_otp));
      if (!matches) throw forbidden('Handover code does not match');
    }
    const closing = input.to === 'cancelled' || input.to === 'declined';
    if (closing && actor.role !== 'customer' && !input.reason) {
      throw unprocessable('reason_required', 'A reason is required');
    }

    await c.query(
      `update fab_jobs set status = $2::fab_job_status,
              delivered_at = case when $2::fab_job_status = 'delivered' then now() else delivered_at end,
              close_reason = case when $2::fab_job_status in ('cancelled', 'declined', 'expired') then $3 else close_reason end,
              quote_expires_at = case when $2::fab_job_status in ('cancelled', 'declined', 'expired') then null else quote_expires_at end
        where id = $1`,
      [job.id, input.to, input.reason ?? (closing ? 'Cancelled by customer' : null)],
    );
    await recordStatus(c, job.id, from, input.to, actor, input.reason);

    if (input.to === 'cancelled' && FAB_PAID_STATUSES.includes(from) && job.payment_status === 'captured') {
      await c.query(`update payments set status = 'refund_pending' where id = $1`, [job.payment_id]);
      await enqueue(c, 'refund.requested', {
        paymentId: job.payment_id,
        jobId: job.id,
        providerPaymentId: job.provider_payment_id,
        amountPaise: job.amount_paise,
      });
    }
    await enqueue(c, 'fab_job.status_changed', { jobId: job.id, from, to: input.to });
  });
  return getJob(pool, input.jobId, input.actor);
}

export async function expireQuotes(batchSize = 50): Promise<number> {
  return withTransaction(async (c) => {
    const { rows } = await c.query<{ id: string; status: FabStatus }>(
      `select id, status from fab_jobs
        where status in ('quoted', 'pending_payment') and quote_expires_at < now()
        order by quote_expires_at limit $1
        for update skip locked`,
      [batchSize],
    );
    for (const { id, status } of rows) {
      await c.query(`update fab_jobs set status = 'expired', quote_expires_at = null, close_reason = 'Quote expired' where id = $1`, [id]);
      await recordStatus(c, id, status, 'expired', { role: 'system', uid: null }, 'Quote expired');
    }
    return rows.length;
  });
}

export async function removeOrphanFiles(olderThanHours = 24, batchSize = 50): Promise<number> {
  const { rows } = await pool.query<{ id: string; storage_key: string }>(
    `delete from fab_files where id in (
       select id from fab_files where job_id is null and created_at < now() - make_interval(hours => $1)
        order by created_at limit $2)
     returning id, storage_key`,
    [olderThanHours, batchSize],
  );
  for (const row of rows) {
    await storage.remove(row.storage_key).catch((err) => logger.warn({ err, key: row.storage_key }, 'orphan file delete failed'));
  }
  return rows.length;
}
