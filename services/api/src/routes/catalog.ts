import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from '../auth.js';
import { cacheGet, cacheSet, catalogGeneration } from '../cache.js';
import { pool } from '../db/pool.js';
import { badRequest, notFound, parse } from '../errors.js';
import { toPgVector } from '../catalog/embeddings.js';
import { embedQuery } from '../catalog/search.js';
import { pipeImage } from '../catalog/submissions.js';
import { distanceSql } from '../lib/geo.js';
import { storage } from '../storage.js';
import { LAT_WINDOW, resolveCart } from '../orders/fulfilment.js';
import { etaMinutes, MAX_ITEMS_PER_LINE } from '../orders/pricing.js';
import { escapeLike, latitude, longitude, pagination, uuid } from './schemas.js';

export const catalogRouter = Router();

const PRODUCT_COLUMNS = `
  p.id, p.sku, p.name, p.brand, p.category_id as "categoryId", c.name as "categoryName",
  p.description,
  case when p.image_key is not null then '/v1/catalog/products/' || p.id::text || '/image' else p.image_url end as "imageUrl",
  p.mrp, p.gst_rate as "gstRate", p.specs, p.badges,
  ('our_pick' = any(p.badges)) as "isChoice",
  i.price, i.stock`;

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

// Every approved, online store whose delivery radius covers the customer.
const NEARBY_CTE = `
  nearby as (
    select s.id, s.name, s.city, s.avg_prep_minutes, d.km
      from stores s
      cross join lateral (select ${distanceSql('$1', '$2')} as km) d
     where s.status = 'approved' and s.is_online
       and s.latitude between $1 - ${LAT_WINDOW} and $1 + ${LAT_WINDOW}
       and d.km <= s.delivery_radius_km
  )`;

// One row per product: the best offer among nearby stores (in stock first, then nearest, then cheapest).
// The shop itself is never named to the customer; only its distance and prep time shape the ETA.
const bestOfferSelect = (extra: { columns?: string; joins?: string } = {}) => `
  select distinct on (p.id)
         ${PRODUCT_COLUMNS},${extra.columns ? `\n         ${extra.columns},` : ''}
         round(n.km::numeric, 1)::float as "distanceKm", n.avg_prep_minutes as "prepMinutes",
         (select coalesce(sum(i2.stock), 0)::int from inventory i2 join nearby n2 on n2.id = i2.store_id
           where i2.product_id = p.id and i2.is_listed and i2.stock > 0) as "nearbyStock",
         (select count(*) from inventory i2 join nearby n2 on n2.id = i2.store_id
           where i2.product_id = p.id and i2.is_listed and i2.stock > 0)::int as "storeCount",
         (select count(*) from inventory i2 join nearby n2 on n2.id = i2.store_id
           where i2.product_id = p.id and i2.is_listed and i2.stock > 0)::int as "offerCount",
         (select min(i3.price) from inventory i3 join nearby n3 on n3.id = i3.store_id
           where i3.product_id = p.id and i3.is_listed and i3.stock > 0)::float as "minPrice"
    from inventory i
    join nearby n on n.id = i.store_id
    join products p on p.id = i.product_id
    join categories c on c.id = p.category_id${extra.joins ? `\n    ${extra.joins}` : ''}
   where i.is_listed and p.is_active`;
const BEST_OFFER_SELECT = bestOfferSelect();

// Hybrid search. A product matches on keywords (full text or a substring of name/SKU/brand/description),
// or on meaning: it is among the closest vectors to the query and above a similarity floor.
// The floor and top-N cap keep loosely related parts out when nothing really matches.
const SEMANTIC_MIN = 0.25;
const SEMANTIC_TOP = 12;
const SEARCH_JOINS = `
    cross join lateral (
      select case when $8::vector is not null and p.embedding_model = $9::text and p.text_embedding is not null
                  then 1 - (p.text_embedding <=> $8::vector) end as sem,
             coalesce(ts_rank_cd(p.search_tsv, plainto_tsquery('english', $4::text)), 0) as kw_rank,
             (p.name ilike $5 or p.sku ilike $5 or p.brand ilike $5) as literal_hit,
             ($4::text is not null and (p.search_tsv @@ plainto_tsquery('english', $4::text) or p.name ilike $5
               or p.sku ilike $5 or p.brand ilike $5 or p.description ilike $5)) as kw_match
    ) s`;
const SEARCH_COLUMNS = `
         s.sem, s.kw_match,
         (coalesce(s.sem, 0) + case when s.literal_hit then 0.5 else 0 end + least(s.kw_rank * 2, 0.5))::float as "searchScore"`;

const withEta = (row: Record<string, unknown>) => ({
  ...row,
  etaMinutes: etaMinutes(row.prepMinutes as number, row.distanceKm as number),
});

catalogRouter.get('/catalog/products', async (req, res) => {
  const q = parse(
    pagination.extend({
      lat: latitude,
      lng: longitude,
      category: z.string().max(60).optional(),
      q: z.string().trim().max(80).optional(),
    }),
    req.query,
  );
  const rawQuery = q.q?.trim() || null;
  // Search embeddings change per query, so only the plain browse is cached. Stock edits, orders and
  // store changes bump the generation; the TTL is only a backstop. Three decimals is about 110 m,
  // close enough that two customers sharing a page also share the same set of nearby shops.
  const cacheKey = rawQuery
    ? null
    : `products:${await catalogGeneration()}:${q.lat.toFixed(3)}:${q.lng.toFixed(3)}:${q.category ?? ''}:${q.limit}:${q.offset}`;
  if (cacheKey) {
    const hit = await cacheGet<Record<string, unknown>>(cacheKey);
    if (hit) {
      res.json(hit);
      return;
    }
  }
  const searchLike = rawQuery ? `%${escapeLike(rawQuery)}%` : null;
  const queryVector = rawQuery ? await embedQuery(rawQuery) : null;
  const { rows } = await pool.query(
    `with ${NEARBY_CTE},
     best as (
       ${bestOfferSelect({ columns: SEARCH_COLUMNS, joins: SEARCH_JOINS })}
         and ($3::text is null or p.category_id = $3)
       order by p.id, (i.stock > 0) desc, n.km asc, i.price asc
     ),
     ranked as (
       select *, row_number() over (order by sem desc nulls last) as sem_rank from best
     )
     select * from ranked
      where $4::text is null or kw_match or (sem >= ${SEMANTIC_MIN} and sem_rank <= ${SEMANTIC_TOP})
      order by (stock > 0) desc, case when $4::text is null then 0 else "searchScore" end desc, name
      limit $6 offset $7`,
    [q.lat, q.lng, q.category ?? null, rawQuery, searchLike, q.limit, q.offset,
      queryVector ? toPgVector(queryVector.vector) : null, queryVector?.model ?? null],
  );
  const stores = await pool.query(`with ${NEARBY_CTE} select count(*)::int as n from nearby`, [q.lat, q.lng]);
  const products = rows.map((row) => {
    delete row.sem;
    delete row.kw_match;
    delete row.sem_rank;
    return withEta(row);
  });
  const body = {
    products,
    nearbyStores: stores.rows[0]?.n ?? 0,
    serviceable: (stores.rows[0]?.n ?? 0) > 0,
    searchMode: rawQuery ? (queryVector ? 'hybrid' : 'keyword') : null,
  };
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
  const { rows } = await pool.query(
    `with ${NEARBY_CTE}
     ${BEST_OFFER_SELECT} and p.id = $3
     order by p.id, (i.stock > 0) desc, n.km asc, i.price asc`,
    [q.lat, q.lng, productId],
  );
  if (!rows[0]) throw notFound('This product is not available near you');
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
  res.json({ product: withEta(rows[0]), offers: offers.rows.map(withEta) });
});

catalogRouter.get('/catalog/products/:productId/reviews', async (req, res) => {
  const productId = parse(uuid, req.params.productId);
  const { rows } = await pool.query(
    `select pr.id, pr.rating, pr.title, pr.content, pr.created_at as "createdAt",
            u.full_name as "authorName"
       from product_reviews pr
       join users u on u.id = pr.user_id
      where pr.product_id = $1
      order by pr.created_at desc`,
    [productId]
  );
  res.json({ reviews: rows });
});

catalogRouter.post('/catalog/products/:productId/reviews', requireAuth, async (req, res) => {
  const productId = parse(uuid, req.params.productId);
  const user = currentUser(req);
  const body = parse(
    z.object({
      rating: z.number().int().min(1).max(5),
      title: z.string().optional(),
      content: z.string().min(1)
    }),
    req.body
  );
  const { rows: orderRows } = await pool.query(
    `select 1 from order_items oi
       join orders o on o.id = oi.order_id
      where oi.product_id = $1 and o.customer_id = $2 and o.status = 'delivered'`,
    [productId, user.uid]
  );
  if (orderRows.length === 0) {
    throw badRequest('You can only review products you have bought and received.');
  }
  
  await pool.query(
    `insert into product_reviews (product_id, user_id, rating, title, content)
     values ($1, $2, $3, $4, $5)
     on conflict (product_id, user_id) do update
     set rating = excluded.rating, title = excluded.title, content = excluded.content`,
    [productId, user.uid, body.rating, body.title, body.content]
  );
  res.json({ success: true });
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


