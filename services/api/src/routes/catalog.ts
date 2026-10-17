import { Router } from 'express';
import { z } from 'zod';
import { currentUser, optionalAuth, requireAuth } from '../auth.js';
import { cacheGet, cacheSet, catalogGeneration } from '../cache.js';
import { pool } from '../db/pool.js';
import { badRequest, notFound, parse } from '../errors.js';
import { countNearbyStores, NEARBY_CTE, nearbyProduct, searchNearby, withEta } from '../catalog/nearby.js';
import { pipeImage } from '../catalog/submissions.js';
import { distanceSql } from '../lib/geo.js';
import { storage } from '../storage.js';
import { listCategories, liveSettings } from '../storefront/service.js';
import { LAT_WINDOW, resolveCart } from '../orders/fulfilment.js';
import { etaMinutes, MAX_ITEMS_PER_LINE } from '../orders/pricing.js';
import { latitude, longitude, pagination, uuid } from './schemas.js';

export const catalogRouter = Router();

catalogRouter.get('/categories', async (_req, res) => {
  const key = `categories:${await catalogGeneration()}`;
  const hit = await cacheGet<{ categories: unknown[] }>(key);
  if (hit) {
    res.json(hit);
    return;
  }
  const { rows } = await pool.query('select id, name from categories order by sort_order, name');
  const body = { categories: rows };
  await cacheSet(key, body, 600);
  res.json(body);
});

/** Everything the storefront needs to lay itself out: the published look and the visible shelf. */
catalogRouter.get('/storefront', async (_req, res) => {
  const key = `storefront:${await catalogGeneration()}`;
  const hit = await cacheGet<Record<string, unknown>>(key);
  if (hit) {
    res.json(hit);
    return;
  }
  const [{ settings, version }, categories] = await Promise.all([liveSettings(), listCategories(pool, { visibleOnly: true })]);
  const body = {
    settings,
    version: version?.id ?? null,
    categories: categories.map(({ id, name, icon, description }) => ({ id, name, icon, description })),
  };
  await cacheSet(key, body, 300);
  res.json(body);
});

catalogRouter.get('/catalog/products', async (req, res) => {
  const q = parse(
    pagination.extend({
      lat: latitude,
      lng: longitude,
      category: z.string().max(60).optional(),
      q: z.string().trim().max(80).optional(),
      maxPrice: z.coerce.number().positive().max(10_000_000).optional(),
    }),
    req.query,
  );
  const rawQuery = q.q?.trim() || null;
  // Search embeddings change per query, so only the plain browse is cached. Stock edits, orders and
  // store changes bump the generation; the TTL is only a backstop. Three decimals is about 110 m,
  // close enough that two customers sharing a page also share the same set of nearby shops.
  const cacheKey = rawQuery || q.maxPrice !== undefined
    ? null
    : `products:${await catalogGeneration()}:${q.lat.toFixed(3)}:${q.lng.toFixed(3)}:${q.category ?? ''}:${q.limit}:${q.offset}`;
  if (cacheKey) {
    const hit = await cacheGet<Record<string, unknown>>(cacheKey);
    if (hit) {
      res.json(hit);
      return;
    }
  }
  const { products, searchMode } = await searchNearby(pool, {
    lat: q.lat,
    lng: q.lng,
    query: rawQuery,
    category: q.category,
    maxPrice: q.maxPrice,
    limit: q.limit,
    offset: q.offset,
  });
  const nearbyStores = await countNearbyStores(pool, q.lat, q.lng);
  const body = { products, nearbyStores, serviceable: nearbyStores > 0, searchMode };
  if (cacheKey) await cacheSet(cacheKey, body, 45);
  res.json(body);
});

catalogRouter.get('/catalog/products/:productId/image', async (req, res) => {
  const productId = parse(uuid, req.params.productId);
  const { rows } = await pool.query<{ image_key: string | null }>('select image_key from products where id = $1 and is_active', [productId]);
  if (!rows[0]?.image_key) throw notFound('Image not found');
  pipeImage(res, { key: rows[0].image_key, stream: await storage.get(rows[0].image_key) }, 'public');
});

catalogRouter.get('/catalog/products/:productId', async (req, res) => {
  const productId = parse(uuid, req.params.productId);
  const q = parse(z.object({ lat: latitude, lng: longitude }), req.query);
  const product = await nearbyProduct(pool, q.lat, q.lng, productId);
  if (!product) throw notFound('This product is not available near you');
  // Anonymous per-shop offers: price, stock and ETA only, so the page can explain a spill-over
  // price without ever naming the shop.
  const offers = await pool.query(
    `with ${NEARBY_CTE}
     select round(n.km::numeric, 1)::float as "distanceKm", i.price, i.stock, n.avg_prep_minutes as "prepMinutes"
       from inventory i join nearby n on n.id = i.store_id
      where i.product_id = $3 and i.is_listed
      order by (i.stock > 0) desc, n.km asc`,
    [q.lat, q.lng, productId],
  );
  res.json({ product, offers: offers.rows.map(withEta) });
});

async function resolveProductDbId(identifier: string): Promise<{ id: string; sku: string; name: string } | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (isUuid) {
    const { rows } = await pool.query<{ id: string; sku: string; name: string }>(
      `select id, sku, name from products where id = $1 limit 1`,
      [identifier]
    );
    if (rows[0]) return rows[0];
  }
  const { rows } = await pool.query<{ id: string; sku: string; name: string }>(
    `select id, sku, name from products where sku = $1 or lower(sku) = lower($1) limit 1`,
    [identifier]
  );
  return rows[0] ?? null;
}

catalogRouter.get('/catalog/products/:productId/reviews', optionalAuth, async (req, res) => {
  const rawId = String(req.params.productId);
  const resolved = await resolveProductDbId(rawId);
  if (!resolved) {
    return res.json({ reviews: [], canReview: false, hasPurchased: false });
  }

  const { rows } = await pool.query<{
    id: string;
    rating: number;
    title: string | null;
    content: string;
    createdAt: string;
    authorName: string;
    userId: string;
  }>(
    `select pr.id, pr.rating, pr.title, pr.content, pr.created_at as "createdAt",
            coalesce(u.full_name, 'Verified Purchaser') as "authorName",
            pr.user_id as "userId"
       from product_reviews pr
       join users u on u.id = pr.user_id
      where pr.product_id = $1
      order by pr.created_at desc`,
    [resolved.id]
  );

  let canReview = false;
  let hasPurchased = false;
  let eligibleOrderNumber: number | null = null;
  let userReview: { rating: number; title: string | null; content: string } | null = null;

  if (req.user) {
    const { rows: orderRows } = await pool.query<{ orderNumber: number; status: string }>(
      `select o.order_number as "orderNumber", o.status
         from order_items oi
         join orders o on o.id = oi.order_id
        where (oi.product_id = $1 or oi.sku = $2)
          and o.customer_id = $3
          and o.status = 'delivered'
        order by o.created_at desc
        limit 1`,
      [resolved.id, resolved.sku, req.user.uid]
    );

    if (orderRows.length > 0 && orderRows[0]) {
      hasPurchased = true;
      canReview = true;
      eligibleOrderNumber = orderRows[0].orderNumber;
    }

    const existing = rows.find((r) => r.userId === req.user?.uid);
    if (existing) {
      userReview = {
        rating: existing.rating,
        title: existing.title,
        content: existing.content,
      };
    }
  }

  res.json({
    reviews: rows.map(({ userId: _uid, ...r }) => r),
    canReview,
    hasPurchased,
    eligibleOrderNumber,
    userReview,
  });
});

catalogRouter.post('/catalog/products/:productId/reviews', requireAuth, async (req, res) => {
  const rawId = String(req.params.productId);
  const resolved = await resolveProductDbId(rawId);
  if (!resolved) {
    throw badRequest('Product not found in catalog');
  }
  const user = currentUser(req);
  const body = parse(
    z.object({
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().max(200).optional(),
      content: z.string().trim().min(2, 'Review content is required').max(2000),
    }),
    req.body
  );

  // STRICT VERIFICATION: ONLY allow rating if the customer has bought and received the item!
  const { rows: orderRows } = await pool.query<{ orderNumber: number }>(
    `select o.order_number as "orderNumber"
       from order_items oi
       join orders o on o.id = oi.order_id
      where (oi.product_id = $1 or oi.sku = $2)
        and o.customer_id = $3
        and o.status = 'delivered'
      order by o.created_at desc
      limit 1`,
    [resolved.id, resolved.sku, user.uid]
  );

  if (orderRows.length === 0 || !orderRows[0]) {
    throw badRequest('You can only rate or review items that have been delivered to you in your order history.');
  }

  await pool.query(
    `insert into product_reviews (product_id, user_id, rating, title, content)
     values ($1, $2, $3, $4, $5)
     on conflict (product_id, user_id) do update
     set rating = excluded.rating, title = excluded.title, content = excluded.content, updated_at = now()`,
    [resolved.id, user.uid, body.rating, body.title || null, body.content]
  );

  res.json({ success: true, orderNumber: orderRows[0].orderNumber });
});
// Cart preview: which store would fulfil these items from this location, and what it costs.
catalogRouter.post('/catalog/resolve', async (req, res) => {
  const body = parse(
    z.object({
      lat: latitude,
      lng: longitude,
      items: z.array(z.object({ productId: uuid, quantity: z.number().int().min(1).max(MAX_ITEMS_PER_LINE) })).min(1).max(40),
    }),
    req.body,
  );
  const quantities = new Map<string, number>();
  for (const { productId, quantity } of body.items) quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  const resolution = await resolveCart(pool, body.lat, body.lng, quantities);
  res.json({
    ...resolution,
    store: resolution.store ? { distanceKm: resolution.store.distanceKm, etaMinutes: resolution.store.etaMinutes } : null,
  });
});

catalogRouter.get('/stores/nearby', async (req, res) => {
  const q = parse(z.object({ lat: latitude, lng: longitude }), req.query);
  const cacheKey = `nearby:${await catalogGeneration()}:${q.lat.toFixed(3)}:${q.lng.toFixed(3)}`;
  const hit = await cacheGet<Record<string, unknown>>(cacheKey);
  if (hit) {
    res.json(hit);
    return;
  }
  // Service coverage only: how many shops reach this point and how fast. No names or addresses.
  const { rows } = await pool.query(
    `select s.avg_prep_minutes as "prepMinutes", d.km as "distanceKm"
       from stores s
       cross join lateral (select ${distanceSql('$1', '$2')} as km) d
      where s.status = 'approved' and s.is_online
        and s.latitude between $1 - ${LAT_WINDOW} and $1 + ${LAT_WINDOW}
        and d.km <= s.delivery_radius_km
      order by d.km
      limit 10`,
    [q.lat, q.lng],
  );
  const stores = rows.map((s) => ({
    ...s,
    distanceKm: Math.round(s.distanceKm * 10) / 10,
    etaMinutes: etaMinutes(s.prepMinutes, s.distanceKm),
  }));
  const body = { stores, serviceable: stores.length > 0 };
  await cacheSet(cacheKey, body, 45);
  res.json(body);
});

// There is deliberately no per-store shelf endpoint: customers browse one pooled catalog and the
// shop behind a listing is not public. Vendors see their own shelf under /vendor, admins under /admin.


