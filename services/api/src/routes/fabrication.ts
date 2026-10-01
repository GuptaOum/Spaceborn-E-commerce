import express, { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { currentUser, requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';
import { badRequest, notFound, parse } from '../errors.js';
import { distanceSql } from '../lib/geo.js';
import { logger } from '../logger.js';
import { markPaid } from '../orders/service.js';
import { verifyPaymentSignature } from '../payments/signatures.js';
import { storage } from '../storage.js';
import {
  acceptQuote,
  createJob,
  getJob,
  getJobFile,
  listCustomerJobs,
  MAX_FILES_PER_JOB,
  saveUpload,
  transitionJob,
} from '../fabrication/service.js';
import { SERVICE_KINDS } from '../fabrication/status.js';
import { deliveryAddress, latitude, longitude, uuid } from './schemas.js';

export const fabricationRouter = Router();

export const LISTING_COLUMNS = `
  l.id, l.store_id as "storeId", l.kind, l.title, l.description, l.materials,
  l.max_x_mm as "maxXmm", l.max_y_mm as "maxYmm", l.max_z_mm as "maxZmm",
  l.starting_price as "startingPrice", l.turnaround_hours as "turnaroundHours",
  l.status, l.review_note as "reviewNote", l.is_active as "isActive", l.created_at as "createdAt"`;

const LAT_WINDOW = 0.27;

const OUT_OF_RANGE_MAX = 5;

/**
 * Makers that deliver to this point, plus the nearest approved makers that do not (so the page can
 * say "X is 8 km away but delivers within 5 km" instead of a bare "nothing here").
 */
fabricationRouter.get('/services/nearby', async (req, res) => {
  const q = parse(
    z.object({
      lat: latitude,
      lng: longitude,
      kind: z.enum(SERVICE_KINDS).optional(),
      city: z.string().trim().optional(),
    }),
    req.query,
  );
  const { rows } = await pool.query(
    `select ${LISTING_COLUMNS}, s.name as "storeName", s.city, d.km as "distanceKm",
            s.delivery_radius_km::float as "deliveryRadiusKm",
            (d.km <= s.delivery_radius_km or ($4::text is not null and lower(btrim(s.city)) = lower(btrim($4)))) as "inRange"
       from service_listings l
       join stores s on s.id = l.store_id
       cross join lateral (select ${distanceSql('$1', '$2')} as km) d
      where l.status = 'approved' and l.is_active and s.status = 'approved'
        and ($3::service_kind is null or l.kind = $3)
        and (
          s.latitude between $1 - ${LAT_WINDOW} and $1 + ${LAT_WINDOW}
          or ($4::text is not null and lower(btrim(s.city)) = lower(btrim($4)))
        )
      order by (d.km <= s.delivery_radius_km or ($4::text is not null and lower(btrim(s.city)) = lower(btrim($4)))) desc, d.km
      limit ${20 + OUT_OF_RANGE_MAX}`,
    [q.lat, q.lng, q.kind ?? null, q.city ?? null],
  );
  const present = ({ inRange: _inRange, ...r }: (typeof rows)[number]) => ({ ...r, distanceKm: Math.round(r.distanceKm * 10) / 10 });
  res.json({
    services: rows.filter((r) => r.inRange).slice(0, 20).map(present),
    outOfRange: rows.filter((r) => !r.inRange).slice(0, OUT_OF_RANGE_MAX).map(present),
  });
});

fabricationRouter.get('/services/:id', async (req, res) => {
  const { rows } = await pool.query(
    `select ${LISTING_COLUMNS}, s.name as "storeName", s.city
       from service_listings l join stores s on s.id = l.store_id
      where l.id = $1 and l.status = 'approved' and s.status = 'approved'`,
    [parse(uuid, req.params.id)],
  );
  if (!rows[0]) throw notFound('Service not found');
  res.json({ service: rows[0] });
});

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'anonymous',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const jobs = Router();
jobs.use(requireAuth);

jobs.post(
  '/uploads',
  uploadLimiter,
  express.raw({ type: 'application/octet-stream', limit: `${config.MAX_UPLOAD_MB}mb` }),
  async (req, res) => {
    const name = req.header('X-File-Name');
    if (!name || !Buffer.isBuffer(req.body)) throw badRequest('Send the file as application/octet-stream with an X-File-Name header');
    const file = await saveUpload(currentUser(req).uid, decodeURIComponent(name), req.body);
    res.status(201).json({ file });
  },
);

const createJobBody = z.object({
  listingId: uuid,
  material: z.string().trim().min(1).max(60),
  quantity: z.number().int().min(1).max(100),
  notes: z.string().trim().max(2000).default(''),
  fileIds: z.array(uuid).min(1).max(MAX_FILES_PER_JOB),
  address: deliveryAddress,
});

const createJobLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? 'anonymous',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

jobs.post('/jobs', createJobLimiter, async (req, res) => {
  const body = parse(createJobBody, req.body);
  res.status(201).json({ job: await createJob({ ...body, customerId: currentUser(req).uid }) });
});

jobs.get('/jobs', async (req, res) => {
  const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }), req.query);
  res.json({ jobs: await listCustomerJobs(currentUser(req).uid, limit) });
});

jobs.get('/jobs/:id', async (req, res) => {
  const user = currentUser(req);
  res.json({ job: await getJob(pool, parse(uuid, req.params.id), { role: 'customer', uid: user.uid }) });
});

jobs.post('/jobs/:id/accept', async (req, res) => {
  res.json(await acceptQuote(parse(uuid, req.params.id), currentUser(req).uid));
});

jobs.post('/jobs/:id/cancel', async (req, res) => {
  const user = currentUser(req);
  const { reason } = parse(z.object({ reason: z.string().trim().max(300).optional() }), req.body ?? {});
  const job = await transitionJob({
    jobId: parse(uuid, req.params.id),
    to: 'cancelled',
    actor: { role: 'customer', uid: user.uid },
    reason: reason || undefined,
  });
  res.json({ job });
});

async function jobPaymentForCustomer(jobId: string, customerId: string) {
  const { rows } = await pool.query<{ provider: string; provider_order_id: string }>(
    `select p.provider, p.provider_order_id from payments p join fab_jobs j on j.id = p.fab_job_id
      where j.id = $1 and j.customer_id = $2`,
    [jobId, customerId],
  );
  if (!rows[0]) throw notFound('Payment not found');
  return rows[0];
}

jobs.post('/jobs/:id/verify', async (req, res) => {
  const user = currentUser(req);
  const jobId = parse(uuid, req.params.id);
  const body = parse(
    z.object({
      razorpayOrderId: z.string().min(1),
      razorpayPaymentId: z.string().min(1),
      razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    req.body,
  );
  const payment = await jobPaymentForCustomer(jobId, user.uid);
  if (payment.provider !== 'razorpay' || payment.provider_order_id !== body.razorpayOrderId) {
    throw badRequest('Payment does not belong to this job');
  }
  if (!verifyPaymentSignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature, config.RAZORPAY_KEY_SECRET!)) {
    throw badRequest('Payment signature is invalid');
  }
  await markPaid(body.razorpayOrderId, body.razorpayPaymentId);
  res.json({ job: await getJob(pool, jobId, { role: 'customer', uid: user.uid }) });
});

if (config.paymentsMode === 'mock') {
  jobs.post('/jobs/:id/mock-pay', async (req, res) => {
    const user = currentUser(req);
    const jobId = parse(uuid, req.params.id);
    const payment = await jobPaymentForCustomer(jobId, user.uid);
    if (payment.provider !== 'mock') throw badRequest('Not a mock payment');
    await markPaid(payment.provider_order_id, `mockpay_${Date.now()}`);
    res.json({ job: await getJob(pool, jobId, { role: 'customer', uid: user.uid }) });
  });
}

jobs.get('/jobs/:id/files/:fileId', async (req, res) => {
  const user = currentUser(req);
  const file = await getJobFile(parse(uuid, req.params.id), parse(uuid, req.params.fileId), { role: 'customer', uid: user.uid });
  await streamFile(res, file);
});

fabricationRouter.use('/fabrication', jobs);

export async function streamFile(res: Response, file: { key: string; fileName: string }) {
  const stream = await storage.get(file.key);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', (err) => {
    logger.error({ err, key: file.key }, 'file stream failed');
    if (!res.headersSent) res.status(404).end();
    else res.destroy(err);
  });
  stream.pipe(res);
}
