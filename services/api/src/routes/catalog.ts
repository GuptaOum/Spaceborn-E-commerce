import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { notFound, parse } from '../errors.js';
import { distanceSql } from '../lib/geo.js';
import { etaMinutes } from '../orders/pricing.js';
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

// Search radius prefilter (~30 km) keeps the distance calculation off most rows.
const LAT_WINDOW = 0.27;

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
