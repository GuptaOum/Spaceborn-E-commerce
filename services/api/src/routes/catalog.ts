import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { notFound, parse } from '../errors.js';
import { distanceSql } from '../lib/geo.js';
import { LAT_WINDOW, resolveCart } from '../orders/fulfilment.js';
import { etaMinutes, MAX_ITEMS_PER_LINE } from '../orders/pricing.js';
import { escapeLike, latitude, longitude, pagination, uuid } from './schemas.js';

export const catalogRouter = Router();

const PRODUCT_COLUMNS = `
  p.id, p.sku, p.name, p.brand, p.category_id as "categoryId", c.name as "categoryName",
  p.description, p.image_url as "imageUrl", p.mrp, p.gst_rate as "gstRate", p.specs,
  i.price, i.stock`;

catalogRouter.get('/categories', async (_req, res) => {
  const { rows } = await pool.query('select id, name from categories order by sort_order, name');
  res.json({ categories: rows });
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
const BEST_OFFER_SELECT = `
  select distinct on (p.id)
         ${PRODUCT_COLUMNS},
         n.id as "storeId", n.name as "storeName", n.city as "storeCity",
         round(n.km::numeric, 1)::float as "distanceKm", n.avg_prep_minutes as "prepMinutes",
         (select count(*) from inventory i2 join nearby n2 on n2.id = i2.store_id
           where i2.product_id = p.id and i2.is_listed and i2.stock > 0)::int as "offerCount",
         (select min(i3.price) from inventory i3 join nearby n3 on n3.id = i3.store_id
           where i3.product_id = p.id and i3.is_listed and i3.stock > 0)::float as "minPrice"
    from inventory i
    join nearby n on n.id = i.store_id
    join products p on p.id = i.product_id
    join categories c on c.id = p.category_id
   where i.is_listed and p.is_active`;

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
  const searchLike = rawQuery ? `%${escapeLike(rawQuery)}%` : null;
  const { rows } = await pool.query(
    `with ${NEARBY_CTE},
     best as (
       ${BEST_OFFER_SELECT}
         and ($3::text is null or p.category_id = $3)
         and (
           $4::text is null
           or (p.search_tsv @@ plainto_tsquery('english', $4))
           or p.name ilike $5 or p.sku ilike $5 or p.brand ilike $5 or p.description ilike $5
         )
       order by p.id, (i.stock > 0) desc, n.km asc, i.price asc
     )
     select * from best order by (stock > 0) desc, name limit $6 offset $7`,
    [q.lat, q.lng, q.category ?? null, rawQuery, searchLike, q.limit, q.offset],
  );
  const stores = await pool.query(`with ${NEARBY_CTE} select count(*)::int as n from nearby`, [q.lat, q.lng]);
  res.json({ products: rows.map(withEta), nearbyStores: stores.rows[0]?.n ?? 0, serviceable: (stores.rows[0]?.n ?? 0) > 0 });
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
  const offers = await pool.query(
    `with ${NEARBY_CTE}
     select n.name as "storeName", n.city, round(n.km::numeric, 1)::float as "distanceKm", i.price, i.stock,
            n.avg_prep_minutes as "prepMinutes"
       from inventory i join nearby n on n.id = i.store_id
      where i.product_id = $3 and i.is_listed
      order by (i.stock > 0) desc, n.km asc`,
    [q.lat, q.lng, productId],
  );
  res.json({ product: withEta(rows[0]), offers: offers.rows.map(withEta) });
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
  res.json(await resolveCart(pool, body.lat, body.lng, quantities));
});

catalogRouter.get('/stores/nearby', async (req, res) => {
  const q = parse(z.object({ lat: latitude, lng: longitude }), req.query);
  const { rows } = await pool.query(
    `select s.id, s.name, s.city, s.address_line as "addressLine", s.avg_prep_minutes as "prepMinutes",
            s.delivery_radius_km as "deliveryRadiusKm", d.km as "distanceKm"
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
  res.json({ stores, serviceable: stores.length > 0 });
});

async function loadStore(storeId: string) {
  const { rows } = await pool.query(
    `select id, name, city, is_online as "isOnline", avg_prep_minutes as "prepMinutes"
       from stores where id = $1 and status = 'approved'`,
    [storeId],
  );
  if (!rows[0]) throw notFound('Store not found');
  return rows[0];
}

catalogRouter.get('/stores/:storeId/products', async (req, res) => {
  const storeId = parse(uuid, req.params.storeId);
  const q = parse(
    pagination.extend({ category: z.string().max(60).optional(), q: z.string().trim().max(80).optional() }),
    req.query,
  );
  const store = await loadStore(storeId);
  const search = q.q ? `%${escapeLike(q.q)}%` : null;
  const { rows } = await pool.query(
    `select ${PRODUCT_COLUMNS}
       from inventory i
       join products p on p.id = i.product_id
       join categories c on c.id = p.category_id
      where i.store_id = $1 and i.is_listed and p.is_active
        and ($2::text is null or p.category_id = $2)
        and ($3::text is null or p.name ilike $3 or p.sku ilike $3 or p.brand ilike $3)
      order by (i.stock > 0) desc, p.name
      limit $4 offset $5`,
    [storeId, q.category ?? null, search, q.limit, q.offset],
  );
  res.json({ store, products: rows });
});

catalogRouter.get('/stores/:storeId/products/:productId', async (req, res) => {
  const storeId = parse(uuid, req.params.storeId);
  const productId = parse(uuid, req.params.productId);
  const store = await loadStore(storeId);
  const { rows } = await pool.query(
    `select ${PRODUCT_COLUMNS}
       from inventory i
       join products p on p.id = i.product_id
       join categories c on c.id = p.category_id
      where i.store_id = $1 and i.product_id = $2 and i.is_listed and p.is_active`,
    [storeId, productId],
  );
  if (!rows[0]) throw notFound('This product is not available at this store');
  res.json({ store, product: rows[0] });
});
