import express, { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { currentUser, requireAuth } from '../auth.js';
import { config } from '../config.js';
import {
  createSubmission,
  deleteSubmission,
  listStoreSubmissions,
  pipeImage,
  saveProductImage,
  submissionImage,
  updateSubmission,
} from '../catalog/submissions.js';
import { pool } from '../db/pool.js';
import { badRequest, conflict, forbidden, notFound, parse, unprocessable } from '../errors.js';
import { listStoreOrders, transitionOrder } from '../orders/service.js';
import { ORDER_STATUSES } from '../orders/status.js';
import { getJob, getJobFile, listStoreJobs, quoteJob, transitionJob } from '../fabrication/service.js';
import { SERVICE_KINDS } from '../fabrication/status.js';
import { LISTING_COLUMNS, streamFile } from './fabrication.js';
import { escapeLike, fabStatusList, latitude, longitude, pagination, phone, pincode, reason, statusList, uuid } from './schemas.js';

export const vendorRouter = Router();
vendorRouter.use(requireAuth);

/**
 * Handover codes are short, so the only thing standing between an assigned vendor and marking an
 * order delivered without handing it over is the number of guesses allowed. Keyed per order so one
 * vendor's fumbled code cannot lock out their other deliveries.
 */
const handoverLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `${currentUser(req).storeId ?? 'none'}:${req.params.id}`,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'too_many_attempts', message: 'Too many incorrect handover codes. Try again later.' } },
});

const STORE_COLUMNS = `
  id, name, phone, gstin, address_line as "addressLine", city, pincode, latitude, longitude,
  delivery_radius_km as "deliveryRadiusKm", avg_prep_minutes as "prepMinutes", status,
  is_online as "isOnline", review_note as "reviewNote", created_at as "createdAt"`;

const gstin = z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GSTIN');

const applicationBody = z.object({
  name: z.string().trim().min(2).max(120),
  phone,
  gstin: gstin.optional(),
  addressLine: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  pincode,
  latitude,
  longitude,
  deliveryRadiusKm: z.number().min(1).max(15).default(5),
});

vendorRouter.get('/store', async (req, res) => {
  const { rows } = await pool.query(`select ${STORE_COLUMNS} from stores where owner_id = $1`, [currentUser(req).uid]);
  res.json({ store: rows[0] ?? null });
});

vendorRouter.post('/applications', async (req, res) => {
  const user = currentUser(req);
  if (user.role === 'admin') throw forbidden('Admins cannot run a store');
  const body = parse(applicationBody, req.body);
  const { rows } = await pool.query(
    `insert into stores (owner_id, name, phone, gstin, address_line, city, pincode, latitude, longitude, delivery_radius_km)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (owner_id) do update set
       name = excluded.name, phone = excluded.phone, gstin = excluded.gstin, address_line = excluded.address_line,
       city = excluded.city, pincode = excluded.pincode, latitude = excluded.latitude, longitude = excluded.longitude,
       delivery_radius_km = excluded.delivery_radius_km, status = 'pending', review_note = null
     where stores.status = 'rejected'
     returning ${STORE_COLUMNS}`,
    [user.uid, body.name, body.phone, body.gstin ?? null, body.addressLine, body.city, body.pincode,
      body.latitude, body.longitude, body.deliveryRadiusKm],
  );
  if (!rows[0]) throw conflict('You already have a store application');
  res.status(201).json({ store: rows[0] });
});

// Claims can be stale for up to an hour, so the store's current status is always checked in the database.
async function requireApprovedStore(req: Request, _res: Response, next: NextFunction) {
  const user = currentUser(req);
  const { rows } = await pool.query<{ id: string }>(
    `select id from stores where owner_id = $1 and status = 'approved'`,
    [user.uid],
  );
  if (!rows[0] || user.role !== 'vendor' || user.storeId !== rows[0].id) {
    throw forbidden('Your store is not approved yet');
  }
  next();
}

const storeId = (req: Request) => currentUser(req).storeId!;

vendorRouter.patch('/store', requireApprovedStore, async (req, res) => {
  const body = parse(
    z.object({
      isOnline: z.boolean().optional(),
      deliveryRadiusKm: z.number().min(1).max(15).optional(),
      prepMinutes: z.number().int().min(2).max(60).optional(),
      phone: phone.optional(),
    }),
    req.body,
  );
  const { rows } = await pool.query(
    `update stores set is_online = coalesce($2, is_online),
                       delivery_radius_km = coalesce($3, delivery_radius_km),
                       avg_prep_minutes = coalesce($4, avg_prep_minutes),
                       phone = coalesce($5, phone)
      where id = $1 returning ${STORE_COLUMNS}`,
    [storeId(req), body.isOnline ?? null, body.deliveryRadiusKm ?? null, body.prepMinutes ?? null, body.phone ?? null],
  );
  res.json({ store: rows[0] });
});

vendorRouter.get('/summary', requireApprovedStore, async (req, res) => {
  const { rows } = await pool.query(
    `select count(*) filter (where status = 'placed') as "awaitingAcceptance",
            count(*) filter (where status in ('accepted', 'packing', 'ready_for_pickup', 'out_for_delivery')) as "inProgress",
            count(*) filter (where status = 'delivered' and delivered_at >= date_trunc('day', now())) as "deliveredToday",
            coalesce(sum(items_total) filter (where status = 'delivered' and delivered_at >= date_trunc('day', now())), 0) as "revenueToday",
            (select count(*) from inventory where store_id = $1 and is_listed and stock <= 5) as "lowStock"
       from orders where store_id = $1`,
    [storeId(req)],
  );
  const summary = Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]));
  res.json({ summary });
});

vendorRouter.get('/inventory', requireApprovedStore, async (req, res) => {
  const q = parse(pagination.extend({ q: z.string().trim().max(80).optional() }), req.query);
  const search = q.q ? `%${escapeLike(q.q)}%` : null;
  const { rows } = await pool.query(
    `select p.id as "productId", p.sku, p.name, p.mrp, p.category_id as "categoryId",
            case when p.image_key is not null then '/v1/catalog/products/' || p.id::text || '/image' else p.image_url end as "imageUrl",
            i.price, i.stock, i.is_listed as "isListed", i.updated_at as "updatedAt"
       from inventory i join products p on p.id = i.product_id
      where i.store_id = $1 and ($2::text is null or p.name ilike $2 or p.sku ilike $2)
      order by i.stock asc, p.name
      limit $3 offset $4`,
    [storeId(req), search, q.limit, q.offset],
  );
  res.json({ items: rows });
});

vendorRouter.get('/catalog', requireApprovedStore, async (req, res) => {
  const q = parse(pagination.extend({ q: z.string().trim().max(80).optional() }), req.query);
  const search = q.q ? `%${escapeLike(q.q)}%` : null;
  const { rows } = await pool.query(
    `select p.id as "productId", p.sku, p.name, p.mrp, p.category_id as "categoryId",
            case when p.image_key is not null then '/v1/catalog/products/' || p.id::text || '/image' else p.image_url end as "imageUrl"
       from products p
      where p.is_active
        and not exists (select 1 from inventory i where i.store_id = $1 and i.product_id = p.id)
        and ($2::text is null or p.name ilike $2 or p.sku ilike $2)
      order by p.name
      limit $3 offset $4`,
    [storeId(req), search, q.limit, q.offset],
  );
  res.json({ products: rows });
});

const inventoryBody = z
  .object({
    price: z.number().positive().max(1_000_000).optional(),
    stock: z.number().int().min(0).max(100_000).optional(),
    stockDelta: z.number().int().min(-100_000).max(100_000).optional(),
    isListed: z.boolean().optional(),
  })
  .refine((b) => !(b.stock !== undefined && b.stockDelta !== undefined), 'Send either stock or stockDelta, not both');

vendorRouter.put('/inventory/:productId', requireApprovedStore, async (req, res) => {
  const productId = parse(uuid, req.params.productId);
  const body = parse(inventoryBody, req.body);

  const product = await pool.query<{ mrp: number }>('select mrp from products where id = $1 and is_active', [productId]);
  if (!product.rows[0]) throw notFound('Product not found');
  if (body.price !== undefined && body.price > product.rows[0].mrp) {
    throw unprocessable('price_above_mrp', `Price cannot exceed the MRP of ₹${product.rows[0].mrp}`);
  }

  const existing = await pool.query('select 1 from inventory where store_id = $1 and product_id = $2', [storeId(req), productId]);
  if (!existing.rows[0] && (body.price === undefined || body.stock === undefined)) {
    throw unprocessable('price_and_stock_required', 'Price and stock are required when listing a new product');
  }

  // Postgres validates NOT NULL on the proposed row before it checks ON CONFLICT, so a plain
  // upsert fails whenever price is omitted. Update existing rows and insert only new ones.
  // stock uses a delta so concurrent orders reducing stock are not overwritten.
  const params = [storeId(req), productId, body.price ?? null, body.stock ?? null, body.stockDelta ?? null, body.isListed ?? null];
  const { rows } = existing.rows[0]
    ? await pool.query(
        `update inventory set
           price = coalesce($3, price),
           stock = case when $4::int is not null then $4
                        when $5::int is not null then greatest(0, stock + $5)
                        else stock end,
           is_listed = coalesce($6, is_listed)
         where store_id = $1 and product_id = $2
         returning product_id as "productId", price, stock, is_listed as "isListed"`,
        params,
      )
    : await pool.query(
        `insert into inventory (store_id, product_id, price, stock, is_listed)
         values ($1, $2, $3, $4, $5)
         on conflict (store_id, product_id) do update set
           price = excluded.price, stock = excluded.stock, is_listed = excluded.is_listed
         returning product_id as "productId", price, stock, is_listed as "isListed"`,
        [storeId(req), productId, body.price, body.stock, body.isListed ?? true],
      );
  if (!rows[0]) throw notFound('Inventory item not found');
  res.json({ item: { ...rows[0], price: Number(rows[0].price) } });
});

const submissionBody = z.object({
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(4000),
  categoryId: z.string().trim().min(1).max(60),
  brand: z.string().trim().max(80).optional(),
  mrp: z.number().positive().max(1_000_000),
  price: z.number().positive().max(1_000_000),
  stock: z.number().int().min(0).max(100_000),
  imageKey: z.string().trim().min(8).max(300),
});

const imageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => currentUser(req).storeId ?? currentUser(req).uid,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

vendorRouter.post(
  '/product-images',
  requireApprovedStore,
  imageLimiter,
  express.raw({ type: 'application/octet-stream', limit: `${config.PRODUCT_IMAGE_MAX_MB}mb` }),
  async (req, res) => {
    const name = req.header('X-File-Name');
    if (!name || !Buffer.isBuffer(req.body)) throw badRequest('Send the photo as application/octet-stream with an X-File-Name header');
    res.status(201).json(await saveProductImage(storeId(req), decodeURIComponent(name), req.body));
  },
);

vendorRouter.get('/product-submissions', requireApprovedStore, async (req, res) => {
  res.json({ submissions: await listStoreSubmissions(storeId(req)) });
});

vendorRouter.post('/product-submissions', requireApprovedStore, async (req, res) => {
  res.status(201).json({ submission: await createSubmission(storeId(req), parse(submissionBody, req.body)) });
});

vendorRouter.patch('/product-submissions/:id', requireApprovedStore, async (req, res) => {
  res.json({ submission: await updateSubmission(storeId(req), parse(uuid, req.params.id), parse(submissionBody, req.body)) });
});

vendorRouter.delete('/product-submissions/:id', requireApprovedStore, async (req, res) => {
  await deleteSubmission(storeId(req), parse(uuid, req.params.id));
  res.status(204).end();
});

vendorRouter.get('/product-submissions/:id/image', requireApprovedStore, async (req, res) => {
  pipeImage(res, await submissionImage(parse(uuid, req.params.id), storeId(req)), 'private');
});

vendorRouter.get('/orders', requireApprovedStore, async (req, res) => {
  const q = parse(z.object({ status: statusList, limit: z.coerce.number().int().min(1).max(100).default(50) }), req.query);
  res.json({ orders: await listStoreOrders(storeId(req), q.status, q.limit) });
});

const listingBody = z.object({
  kind: z.enum(SERVICE_KINDS),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).default(''),
  materials: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  maxXmm: z.number().int().min(10).max(5000),
  maxYmm: z.number().int().min(10).max(5000),
  maxZmm: z.number().int().min(1).max(5000),
  startingPrice: z.number().min(0).max(1_000_000),
  turnaroundHours: z.number().int().min(1).max(720),
});

vendorRouter.get('/services', requireApprovedStore, async (req, res) => {
  const { rows } = await pool.query(`select ${LISTING_COLUMNS} from service_listings l where l.store_id = $1 order by l.kind`, [
    storeId(req),
  ]);
  res.json({ services: rows });
});

// Creating or changing what is offered always goes back to admin review.
vendorRouter.post('/services', requireApprovedStore, async (req, res) => {
  const b = parse(listingBody, req.body);
  const materials = [...new Set(b.materials)];
  const { rows } = await pool.query(
    `insert into service_listings as l (store_id, kind, title, description, materials, max_x_mm, max_y_mm, max_z_mm, starting_price, turnaround_hours)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (store_id, kind) do update set
       title = excluded.title, description = excluded.description, materials = excluded.materials,
       max_x_mm = excluded.max_x_mm, max_y_mm = excluded.max_y_mm, max_z_mm = excluded.max_z_mm,
       starting_price = excluded.starting_price, turnaround_hours = excluded.turnaround_hours,
       status = 'pending', review_note = null
     where l.status in ('pending', 'approved', 'rejected')
     returning ${LISTING_COLUMNS}`,
    [storeId(req), b.kind, b.title, b.description, materials, b.maxXmm, b.maxYmm, b.maxZmm, b.startingPrice, b.turnaroundHours],
  );
  if (!rows[0]) throw conflict('This service is suspended. Contact Spaceborn support.');
  res.status(201).json({ service: rows[0] });
});

vendorRouter.patch('/services/:id', requireApprovedStore, async (req, res) => {
  const b = parse(z.object({ isActive: z.boolean() }), req.body);
  const { rows } = await pool.query(
    `update service_listings l set is_active = $3 where l.id = $1 and l.store_id = $2 returning ${LISTING_COLUMNS}`,
    [parse(uuid, req.params.id), storeId(req), b.isActive],
  );
  if (!rows[0]) throw notFound('Service not found');
  res.json({ service: rows[0] });
});

const vendorActor = (req: Request) => {
  const user = currentUser(req);
  return { role: 'vendor' as const, uid: user.uid, storeId: user.storeId };
};

vendorRouter.get('/fab-jobs', requireApprovedStore, async (req, res) => {
  const q = parse(z.object({ status: fabStatusList, limit: z.coerce.number().int().min(1).max(100).default(50) }), req.query);
  res.json({ jobs: await listStoreJobs(storeId(req), q.status, q.limit) });
});

vendorRouter.get('/fab-jobs/:id', requireApprovedStore, async (req, res) => {
  res.json({ job: await getJob(pool, parse(uuid, req.params.id), vendorActor(req)) });
});

vendorRouter.get('/fab-jobs/:id/files/:fileId', requireApprovedStore, async (req, res) => {
  const file = await getJobFile(parse(uuid, req.params.id), parse(uuid, req.params.fileId), vendorActor(req));
  await streamFile(res, file);
});

vendorRouter.post('/fab-jobs/:id/quote', requireApprovedStore, async (req, res) => {
  const b = parse(
    z.object({
      amount: z.number().positive().max(1_000_000),
      note: z.string().trim().max(1000).optional(),
      readyInHours: z.number().int().min(1).max(720),
    }),
    req.body,
  );
  res.json({ job: await quoteJob({ jobId: parse(uuid, req.params.id), vendor: vendorActor(req), ...b }) });
});

vendorRouter.post('/fab-jobs/:id/transition', requireApprovedStore, handoverLimiter, async (req, res) => {
  const b = parse(
    z.object({
      to: z.enum(['declined', 'ready', 'out_for_delivery', 'delivered', 'cancelled']),
      reason: reason.optional(),
      otp: z.string().regex(/^\d{4}$/).optional(),
    }),
    req.body,
  );
  res.json({ job: await transitionJob({ jobId: parse(uuid, req.params.id), actor: vendorActor(req), ...b }) });
});

vendorRouter.post('/orders/:id/transition', requireApprovedStore, handoverLimiter, async (req, res) => {
  const body = parse(
    z.object({ to: z.enum(ORDER_STATUSES), reason: reason.optional(), otp: z.string().regex(/^\d{4}$/).optional() }),
    req.body,
  );
  const user = currentUser(req);
  const order = await transitionOrder({
    orderId: parse(uuid, req.params.id),
    to: body.to,
    reason: body.reason,
    otp: body.otp,
    actor: { role: 'vendor', uid: user.uid, storeId: user.storeId },
  });
  res.json({ order });
});
