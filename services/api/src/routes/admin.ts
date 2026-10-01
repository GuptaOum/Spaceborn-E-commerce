import { Router } from 'express';
import { z } from 'zod';
import {
  adminScope, currentUser, inScope, requireAdmin, requireAuth, requireGlobalAdmin, requireOwner, revokeSessions,
  scopeCities, setRoleClaims,
} from '../auth.js';
import { addMember, audit, listAudit, listMembers, listRegions, memberEmail, regionList, removeMember, updateMember } from '../admin/team.js';
import { approveSubmission, findSimilar, getAdminSubmission, listAdminSubmissions, pipeImage, rejectSubmission, submissionImage } from '../catalog/submissions.js';
import { pool, withTransaction } from '../db/pool.js';
import { conflict, notFound, parse } from '../errors.js';
import { listAllOrders, orderCity, transitionOrder } from '../orders/service.js';
import { getJobFile, jobCity, listAllJobs, transitionJob } from '../fabrication/service.js';
import { LISTING_COLUMNS, streamFile } from './fabrication.js';
import { escapeLike, fabStatusList, pagination, reason, statusList, uuid } from './schemas.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// Every regional query uses the same predicate; `cities` is null for admins who see all regions.
const CITY = (param: string) => `(${param}::text[] is null or lower(btrim(s.city)) = any(${param}))`;

adminRouter.get('/whoami', (req, res) => {
  const scope = adminScope(req);
  res.json({ admin: { email: scope.email, regions: scope.regions, isOwner: scope.isOwner, isGlobal: scope.regions === null } });
});

adminRouter.get('/overview', async (req, res) => {
  const cities = scopeCities(adminScope(req));
  const { rows } = await pool.query(
    `select (select count(*) from stores s where s.status = 'pending' and ${CITY('$1')}) as "pendingStores",
            (select count(*) from stores s where s.status = 'approved' and ${CITY('$1')}) as "approvedStores",
            (select count(*) from stores s where s.status = 'approved' and s.is_online and ${CITY('$1')}) as "onlineStores",
            (select count(*) from products where is_active) as "activeProducts",
            (select count(*) from orders o join stores s on s.id = o.store_id
              where o.created_at >= date_trunc('day', now()) and o.status <> 'pending_payment' and ${CITY('$1')}) as "ordersToday",
            (select coalesce(sum(o.grand_total), 0) from orders o join stores s on s.id = o.store_id
              where o.status = 'delivered' and o.delivered_at >= date_trunc('day', now()) and ${CITY('$1')}) as "gmvToday",
            (select count(*) from payments p join orders o on o.id = p.order_id join stores s on s.id = o.store_id
              where p.status = 'refund_pending' and ${CITY('$1')}) as "refundsPending",
            (select count(*) from service_listings l join stores s on s.id = l.store_id
              where l.status = 'pending' and ${CITY('$1')}) as "pendingServices",
            (select count(*) from product_submissions ps join stores s on s.id = ps.store_id
              where ps.status = 'pending' and ${CITY('$1')}) as "pendingProducts",
            (select count(*) from fab_jobs j join stores s on s.id = j.store_id
              where j.status in ('submitted', 'quoted', 'pending_payment', 'in_production', 'ready', 'out_for_delivery')
                and ${CITY('$1')}) as "activeFabJobs"`,
    [cities],
  );
  res.json({ overview: Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)])) });
});

/** Counts per status for the review queues, so the panel can label its filters and badges. */
adminRouter.get('/queue', async (req, res) => {
  const cities = scopeCities(adminScope(req));
  const { rows } = await pool.query<{ queue: string; status: string; n: number }>(
    `select 'stores' as queue, s.status::text as status, count(*)::int as n from stores s where ${CITY('$1')} group by s.status
     union all
     select 'services', l.status::text, count(*)::int from service_listings l join stores s on s.id = l.store_id where ${CITY('$1')} group by l.status
     union all
     select 'submissions', ps.status::text, count(*)::int from product_submissions ps join stores s on s.id = ps.store_id where ${CITY('$1')} group by ps.status`,
    [cities],
  );
  const queue: Record<string, Record<string, number>> = { stores: {}, services: {}, submissions: {} };
  for (const r of rows) queue[r.queue]![r.status] = r.n;
  res.json({ queue });
});

// ---------------------------------------------------------------------------------------------
// Admin team (owners manage it; everyone can see who is on it)

adminRouter.get('/team', async (_req, res) => {
  res.json({ members: await listMembers() });
});

adminRouter.get('/regions', async (_req, res) => {
  res.json({ regions: await listRegions() });
});

const memberBody = z.object({
  email: memberEmail,
  displayName: z.string().trim().min(2).max(80).optional(),
  regions: regionList.nullable().default(null),
  isOwner: z.boolean().default(false),
  note: z.string().trim().max(300).optional(),
});

adminRouter.post('/team', requireOwner, async (req, res) => {
  const b = parse(memberBody, req.body);
  const member = await addMember(b, adminScope(req));
  await audit(req, 'team.add', { type: 'admin', id: member.email }, { regions: member.regions, isOwner: member.isOwner });
  res.status(201).json({ member });
});

adminRouter.patch('/team/:email', requireOwner, async (req, res) => {
  const email = parse(memberEmail, req.params.email);
  const b = parse(
    z.object({
      displayName: z.string().trim().min(2).max(80).nullable().optional(),
      regions: regionList.nullable().optional(),
      isOwner: z.boolean().optional(),
      note: z.string().trim().max(300).nullable().optional(),
    }),
    req.body,
  );
  const member = await updateMember(email, b, adminScope(req));
  await audit(req, 'team.update', { type: 'admin', id: member.email }, { regions: member.regions, isOwner: member.isOwner });
  res.json({ member });
});

adminRouter.delete('/team/:email', requireOwner, async (req, res) => {
  const email = parse(memberEmail, req.params.email);
  const result = await removeMember(email, adminScope(req));
  await audit(req, 'team.remove', { type: 'admin', id: result.email });
  res.json(result);
});

adminRouter.get('/audit', async (req, res) => {
  const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
  res.json({ entries: await listAudit(q.limit, scopeCities(adminScope(req))) });
});

// ---------------------------------------------------------------------------------------------
// Stores

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
      where ($1::store_status is null or s.status = $1) and ${CITY('$4')}
      order by s.created_at desc
      limit $2 offset $3`,
    [q.status ?? null, q.limit, q.offset, scopeCities(adminScope(req))],
  );
  res.json({ stores: rows });
});

type StoreDecision = 'approved' | 'rejected' | 'suspended';

async function decideStore(storeId: string, decision: StoreDecision, note: string | null, cities: string[] | null) {
  const allowedFrom: Record<StoreDecision, string[]> = {
    approved: ['pending', 'suspended'],
    rejected: ['pending'],
    suspended: ['approved'],
  };
  return withTransaction(async (c) => {
    const { rows } = await c.query(
      `select s.id, s.owner_id, s.status, s.city, s.name from stores s where s.id = $1 and ${CITY('$2')} for update`,
      [storeId, cities],
    );
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
    return { id: storeId, status: decision, city: store.city as string, name: store.name as string };
  });
}

for (const decision of ['approve', 'reject', 'suspend'] as const) {
  const status: StoreDecision = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'suspended';
  adminRouter.post(`/stores/:id/${decision}`, async (req, res) => {
    const note = decision === 'approve' ? null : parse(z.object({ reason }), req.body).reason;
    const store = await decideStore(parse(uuid, req.params.id), status, note, scopeCities(adminScope(req)));
    await audit(req, `store.${decision}`, { type: 'store', id: store.id, city: store.city }, { name: store.name, reason: note });
    res.json({ store: { id: store.id, status: store.status } });
  });
}

// ---------------------------------------------------------------------------------------------
// Master catalog: company-wide, so writes need an admin without a regional restriction.

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

adminRouter.post('/products', requireGlobalAdmin, async (req, res) => {
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
  await audit(req, 'product.create', { type: 'product', id: rows[0].id }, { sku: b.sku, name: b.name });
  res.status(201).json({ product: rows[0] });
});

adminRouter.patch('/products/:id', requireGlobalAdmin, async (req, res) => {
  const b = parse(productBody.partial().omit({ sku: true }), req.body);
  const { rows } = await pool.query(
    `update products set
       name = coalesce($2, name), category_id = coalesce($3, category_id), brand = coalesce($4, brand),
       description = coalesce($5, description), image_url = coalesce($6, image_url), mrp = coalesce($7, mrp),
       gst_rate = coalesce($8, gst_rate), hsn = coalesce($9, hsn), specs = coalesce($10, specs),
       is_active = coalesce($11, is_active),
       -- New text means a stale search vector; the worker re-embeds it within a minute.
       text_embedding = case when $2::text is not null or $5::text is not null then null else text_embedding end
     where id = $1
     returning ${PRODUCT_COLUMNS}`,
    [parse(uuid, req.params.id), b.name ?? null, b.categoryId ?? null, b.brand ?? null, b.description ?? null,
      b.imageUrl ?? null, b.mrp ?? null, b.gstRate ?? null, b.hsn ?? null, b.specs ? JSON.stringify(b.specs) : null,
      b.isActive ?? null],
  );
  if (!rows[0]) throw notFound('Product not found');
  await audit(req, 'product.update', { type: 'product', id: rows[0].id }, { changed: Object.keys(b) });
  res.json({ product: rows[0] });
});

// ---------------------------------------------------------------------------------------------
// Vendor product submissions

adminRouter.get('/product-submissions', async (req, res) => {
  const q = parse(
    pagination.extend({ status: z.enum(['pending', 'approved', 'rejected']).optional() }),
    req.query,
  );
  res.json({ submissions: await listAdminSubmissions(q.status ?? null, q.limit, q.offset, scopeCities(adminScope(req))) });
});

adminRouter.get('/product-submissions/:id/image', async (req, res) => {
  pipeImage(res, await submissionImage(parse(uuid, req.params.id), null, scopeCities(adminScope(req))), 'private');
});

adminRouter.get('/product-submissions/:id', async (req, res) => {
  const id = parse(uuid, req.params.id);
  const submission = await getAdminSubmission(id, scopeCities(adminScope(req)));
  res.json({ submission, similar: await findSimilar(pool, id) });
});

adminRouter.post('/product-submissions/:id/approve', async (req, res) => {
  const body = parse(z.object({ mergeIntoProductId: uuid.optional() }), req.body ?? {});
  const submission = await approveSubmission(parse(uuid, req.params.id), body.mergeIntoProductId ?? null, scopeCities(adminScope(req)));
  await audit(req, 'submission.approve', { type: 'product_submission', id: submission.id, city: submission.city }, {
    name: submission.name, productId: submission.productId, merged: !!body.mergeIntoProductId,
  });
  res.json({ submission: { id: submission.id, status: submission.status, productId: submission.productId } });
});

adminRouter.post('/product-submissions/:id/reject', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  const submission = await rejectSubmission(parse(uuid, req.params.id), body.reason, scopeCities(adminScope(req)));
  await audit(req, 'submission.reject', { type: 'product_submission', id: submission.id, city: submission.city }, {
    name: submission.name, reason: body.reason,
  });
  res.json({ submission: { id: submission.id, status: submission.status } });
});

// ---------------------------------------------------------------------------------------------
// Orders

adminRouter.get('/orders', async (req, res) => {
  const q = parse(z.object({ status: statusList, limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
  res.json({ orders: await listAllOrders(q.status, q.limit, scopeCities(adminScope(req))) });
});

adminRouter.post('/orders/:id/cancel', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  const orderId = parse(uuid, req.params.id);
  const city = await orderCity(orderId);
  if (!city || !inScope(adminScope(req), city)) throw notFound('Order not found');
  const order = await transitionOrder({
    orderId,
    to: 'cancelled',
    reason: body.reason,
    actor: { role: 'admin', uid: currentUser(req).uid },
  });
  await audit(req, 'order.cancel', { type: 'order', id: orderId, city }, { reason: body.reason });
  res.json({ order });
});

// ---------------------------------------------------------------------------------------------
// Print & CNC services

adminRouter.get('/services', async (req, res) => {
  const q = parse(
    pagination.extend({ status: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional() }),
    req.query,
  );
  const { rows } = await pool.query(
    `select ${LISTING_COLUMNS}, s.name as "storeName", s.city, s.status as "storeStatus", u.email as "ownerEmail"
       from service_listings l join stores s on s.id = l.store_id join users u on u.id = s.owner_id
      where ($1::listing_status is null or l.status = $1) and ${CITY('$4')}
      order by l.updated_at desc
      limit $2 offset $3`,
    [q.status ?? null, q.limit, q.offset, scopeCities(adminScope(req))],
  );
  res.json({ services: rows });
});

type ListingDecision = 'approved' | 'rejected' | 'suspended';

async function decideListing(listingId: string, decision: ListingDecision, note: string | null, cities: string[] | null) {
  const allowedFrom: Record<ListingDecision, string[]> = {
    approved: ['pending', 'suspended'],
    rejected: ['pending'],
    suspended: ['approved'],
  };
  return withTransaction(async (c) => {
    const { rows } = await c.query(
      `select l.id, l.status, l.kind, s.status as store_status, s.city
         from service_listings l join stores s on s.id = l.store_id
        where l.id = $1 and ${CITY('$2')} for update of l`,
      [listingId, cities],
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
    return { id: listingId, status: decision, city: listing.city as string, kind: listing.kind as string };
  });
}

for (const decision of ['approve', 'reject', 'suspend'] as const) {
  const status: ListingDecision = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'suspended';
  adminRouter.post(`/services/:id/${decision}`, async (req, res) => {
    const note = decision === 'approve' ? null : parse(z.object({ reason }), req.body).reason;
    const service = await decideListing(parse(uuid, req.params.id), status, note, scopeCities(adminScope(req)));
    await audit(req, `service.${decision}`, { type: 'service_listing', id: service.id, city: service.city }, { kind: service.kind, reason: note });
    res.json({ service: { id: service.id, status: service.status } });
  });
}

// ---------------------------------------------------------------------------------------------
// Print jobs

adminRouter.get('/fab-jobs', async (req, res) => {
  const q = parse(z.object({ status: fabStatusList, limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
  res.json({ jobs: await listAllJobs(q.status, q.limit, scopeCities(adminScope(req))) });
});

async function jobInScope(req: Parameters<typeof adminScope>[0], jobId: string) {
  const city = await jobCity(jobId);
  if (!city || !inScope(adminScope(req), city)) throw notFound('Job not found');
  return city;
}

adminRouter.get('/fab-jobs/:id/files/:fileId', async (req, res) => {
  const jobId = parse(uuid, req.params.id);
  await jobInScope(req, jobId);
  const file = await getJobFile(jobId, parse(uuid, req.params.fileId), { role: 'admin', uid: currentUser(req).uid });
  await streamFile(res, file);
});

adminRouter.post('/fab-jobs/:id/cancel', async (req, res) => {
  const body = parse(z.object({ reason }), req.body);
  const jobId = parse(uuid, req.params.id);
  const city = await jobInScope(req, jobId);
  const job = await transitionJob({
    jobId,
    to: 'cancelled',
    reason: body.reason,
    actor: { role: 'admin', uid: currentUser(req).uid },
  });
  await audit(req, 'fabjob.cancel', { type: 'fab_job', id: jobId, city }, { reason: body.reason });
  res.json({ job });
});
