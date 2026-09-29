import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAdmin, requireAuth, revokeSessions, setRoleClaims } from '../auth.js';
import { pool, withTransaction } from '../db/pool.js';
import { conflict, notFound, parse } from '../errors.js';
import { listAllOrders, transitionOrder } from '../orders/service.js';
import { getJobFile, listAllJobs, transitionJob } from '../fabrication/service.js';
import { LISTING_COLUMNS, streamFile } from './fabrication.js';
import { escapeLike, fabStatusList, pagination, reason, statusList, uuid } from './schemas.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/overview', async (_req, res) => {
  const { rows } = await pool.query(
    `select (select count(*) from stores where status = 'pending') as "pendingStores",
            (select count(*) from stores where status = 'approved') as "approvedStores",
            (select count(*) from stores where status = 'approved' and is_online) as "onlineStores",
            (select count(*) from products where is_active) as "activeProducts",
            (select count(*) from orders where created_at >= date_trunc('day', now()) and status <> 'pending_payment') as "ordersToday",
            (select coalesce(sum(grand_total), 0) from orders where status = 'delivered' and delivered_at >= date_trunc('day', now())) as "gmvToday",
            (select count(*) from payments where status = 'refund_pending') as "refundsPending",
            (select count(*) from service_listings where status = 'pending') as "pendingServices",
            (select count(*) from fab_jobs where status in ('submitted', 'quoted', 'pending_payment', 'in_production', 'ready', 'out_for_delivery')) as "activeFabJobs"`,
  );
  res.json({ overview: Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)])) });
});

adminRouter.get('/stores', async (req, res) => {
  const q = parse(
    pagination.extend({ status: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional() }),
    req.query,
  );
  const { rows } = await pool.query(
    `select s.id, s.name, s.phone, s.gstin, s.address_line as "addressLine", s.city, s.pincode,
            s.latitude, s.longitude, s.delivery_radius_km as "deliveryRadiusKm", s.status, s.is_online as "isOnline",
            s.review_note as "reviewNote", s.created_at as "createdAt",
            u.email as "ownerEmail", u.full_name as "ownerName"
       from stores s join users u on u.id = s.owner_id
      where ($1::store_status is null or s.status = $1)
      order by s.created_at desc
      limit $2 offset $3`,
    [q.status ?? null, q.limit, q.offset],
  );
  res.json({ stores: rows });
});

type StoreDecision = 'approved' | 'rejected' | 'suspended';

async function decideStore(storeId: string, decision: StoreDecision, note: string | null) {
  const allowedFrom: Record<StoreDecision, string[]> = {
    approved: ['pending', 'suspended'],
    rejected: ['pending'],
    suspended: ['approved'],
  };
  return withTransaction(async (c) => {
    const { rows } = await c.query('select id, owner_id, status from stores where id = $1 for update', [storeId]);
    const store = rows[0];
    if (!store) throw notFound('Store not found');
    if (!allowedFrom[decision].includes(store.status)) throw conflict(`A ${store.status} store cannot be ${decision}`);

    await c.query(
      `update stores set status = $2::store_status, review_note = $3,
              is_online = case when $2::store_status = 'approved' then is_online else false end
        where id = $1`,
      [storeId, decision, note],
    );

    // Firebase is updated inside the transaction so a failure rolls the status change back.
    if (decision === 'approved') {
      await setRoleClaims(store.owner_id, 'vendor', storeId, c);
    } else if (store.status === 'approved') {
      await setRoleClaims(store.owner_id, 'customer', null, c);
      await revokeSessions(store.owner_id);
    }
    return { id: storeId, status: decision };
  });
}

adminRouter.post('/stores/:id/approve', async (req, res) => {
  res.json({ store: await decideStore(parse(uuid, req.params.id), 'approved', null) });
});

adminRouter.post('/stores/:id/reject', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  res.json({ store: await decideStore(parse(uuid, req.params.id), 'rejected', body.reason) });
});

adminRouter.post('/stores/:id/suspend', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  res.json({ store: await decideStore(parse(uuid, req.params.id), 'suspended', body.reason) });
});

const PRODUCT_COLUMNS = `
  id, sku, name, category_id as "categoryId", brand, description, image_url as "imageUrl",
  mrp, gst_rate as "gstRate", hsn, specs, is_active as "isActive", updated_at as "updatedAt"`;

adminRouter.get('/products', async (req, res) => {
  const q = parse(pagination.extend({ q: z.string().trim().max(80).optional() }), req.query);
  const search = q.q ? `%${escapeLike(q.q)}%` : null;
  const { rows } = await pool.query(
    `select ${PRODUCT_COLUMNS},
            (select count(*)::int from inventory i where i.product_id = p.id and i.is_listed) as "storeCount"
       from products p
      where ($1::text is null or p.name ilike $1 or p.sku ilike $1)
      order by p.updated_at desc
      limit $2 offset $3`,
    [search, q.limit, q.offset],
  );
  res.json({ products: rows });
});

const productBody = z.object({
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/),
  name: z.string().trim().min(3).max(200),
  categoryId: z.string().trim().min(1),
  brand: z.string().trim().max(80).optional(),
  description: z.string().trim().max(4000).default(''),
  imageUrl: z.string().url().optional(),
  mrp: z.number().positive().max(1_000_000),
  gstRate: z.number().min(0).max(28).default(18),
  hsn: z.string().trim().regex(/^\d{4,8}$/).optional(),
  specs: z.record(z.string().max(200)).default({}),
  isActive: z.boolean().default(true),
});

adminRouter.post('/products', async (req, res) => {
  const b = parse(productBody, req.body);
  const { rows } = await pool.query(
    `insert into products (sku, name, category_id, brand, description, image_url, mrp, gst_rate, hsn, specs, is_active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (sku) do nothing
     returning ${PRODUCT_COLUMNS}`,
    [b.sku, b.name, b.categoryId, b.brand ?? null, b.description, b.imageUrl ?? null, b.mrp, b.gstRate, b.hsn ?? null,
      JSON.stringify(b.specs), b.isActive],
  );
  if (!rows[0]) throw conflict(`SKU ${b.sku} already exists`);
  res.status(201).json({ product: rows[0] });
});

adminRouter.patch('/products/:id', async (req, res) => {
  const b = parse(productBody.partial().omit({ sku: true }), req.body);
  const { rows } = await pool.query(
    `update products set
       name = coalesce($2, name), category_id = coalesce($3, category_id), brand = coalesce($4, brand),
       description = coalesce($5, description), image_url = coalesce($6, image_url), mrp = coalesce($7, mrp),
       gst_rate = coalesce($8, gst_rate), hsn = coalesce($9, hsn), specs = coalesce($10, specs),
       is_active = coalesce($11, is_active)
     where id = $1
     returning ${PRODUCT_COLUMNS}`,
    [parse(uuid, req.params.id), b.name ?? null, b.categoryId ?? null, b.brand ?? null, b.description ?? null,
      b.imageUrl ?? null, b.mrp ?? null, b.gstRate ?? null, b.hsn ?? null, b.specs ? JSON.stringify(b.specs) : null,
      b.isActive ?? null],
  );
  if (!rows[0]) throw notFound('Product not found');
  res.json({ product: rows[0] });
});

adminRouter.get('/orders', async (req, res) => {
  const q = parse(z.object({ status: statusList, limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
  res.json({ orders: await listAllOrders(q.status, q.limit) });
});

adminRouter.get('/services', async (req, res) => {
  const q = parse(
    pagination.extend({ status: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional() }),
    req.query,
  );
  const { rows } = await pool.query(
    `select ${LISTING_COLUMNS}, s.name as "storeName", s.city, s.status as "storeStatus", u.email as "ownerEmail"
       from service_listings l join stores s on s.id = l.store_id join users u on u.id = s.owner_id
      where ($1::listing_status is null or l.status = $1)
      order by l.updated_at desc
      limit $2 offset $3`,
    [q.status ?? null, q.limit, q.offset],
  );
  res.json({ services: rows });
});

type ListingDecision = 'approved' | 'rejected' | 'suspended';

async function decideListing(listingId: string, decision: ListingDecision, note: string | null) {
  const allowedFrom: Record<ListingDecision, string[]> = {
    approved: ['pending', 'suspended'],
    rejected: ['pending'],
    suspended: ['approved'],
  };
  return withTransaction(async (c) => {
    const { rows } = await c.query(
      `select l.id, l.status, s.status as store_status
         from service_listings l join stores s on s.id = l.store_id
        where l.id = $1 for update of l`,
      [listingId],
    );
    const listing = rows[0];
    if (!listing) throw notFound('Service not found');
    if (!allowedFrom[decision].includes(listing.status)) throw conflict(`A ${listing.status} service cannot be ${decision}`);
    if (decision === 'approved' && listing.store_status !== 'approved') throw conflict('Approve the store before its services');
    await c.query('update service_listings set status = $2::listing_status, review_note = $3 where id = $1', [
      listingId,
      decision,
      note,
    ]);
    return { id: listingId, status: decision };
  });
}

adminRouter.post('/services/:id/approve', async (req, res) => {
  res.json({ service: await decideListing(parse(uuid, req.params.id), 'approved', null) });
});

adminRouter.post('/services/:id/reject', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  res.json({ service: await decideListing(parse(uuid, req.params.id), 'rejected', body.reason) });
});

adminRouter.post('/services/:id/suspend', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  res.json({ service: await decideListing(parse(uuid, req.params.id), 'suspended', body.reason) });
});

adminRouter.get('/fab-jobs', async (req, res) => {
  const q = parse(z.object({ status: fabStatusList, limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
  res.json({ jobs: await listAllJobs(q.status, q.limit) });
});

adminRouter.get('/fab-jobs/:id/files/:fileId', async (req, res) => {
  const file = await getJobFile(parse(uuid, req.params.id), parse(uuid, req.params.fileId), { role: 'admin', uid: currentUser(req).uid });
  await streamFile(res, file);
});

adminRouter.post('/fab-jobs/:id/cancel', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  const job = await transitionJob({
    jobId: parse(uuid, req.params.id),
    to: 'cancelled',
    reason: body.reason,
    actor: { role: 'admin', uid: currentUser(req).uid },
  });
  res.json({ job });
});

adminRouter.post('/orders/:id/cancel', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  const order = await transitionOrder({
    orderId: parse(uuid, req.params.id),
    to: 'cancelled',
    reason: body.reason,
    actor: { role: 'admin', uid: currentUser(req).uid },
  });
  res.json({ order });
});
