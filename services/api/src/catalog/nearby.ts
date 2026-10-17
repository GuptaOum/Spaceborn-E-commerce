import type { Db } from '../db/pool.js';
import { distanceSql } from '../lib/geo.js';
import { LAT_WINDOW } from '../orders/fulfilment.js';
import { etaMinutes } from '../orders/pricing.js';
import { escapeLike } from '../routes/schemas.js';
import { toPgVector } from './embeddings.js';
import { embedQuery } from './search.js';

const PRODUCT_COLUMNS = `
  p.id, p.sku, p.name, p.brand, p.category_id as "categoryId", c.name as "categoryName",
  p.description,
  case when p.image_key is not null then '/v1/catalog/products/' || p.id::text || '/image' else p.image_url end as "imageUrl",
  p.mrp, p.gst_rate as "gstRate", p.specs, p.badges,
  ('our_pick' = any(p.badges)) as "isChoice",
  i.price, i.stock`;

// Every approved, online store whose delivery radius covers the customer.
export const NEARBY_CTE = `
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

export type NearbyOffer = Record<string, unknown> & {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  nearbyStock: number;
  distanceKm: number;
  prepMinutes: number;
  etaMinutes: number;
};

export const withEta = <T extends Record<string, unknown>>(row: T) => ({
  ...row,
  etaMinutes: etaMinutes(row.prepMinutes as number, row.distanceKm as number),
});

export interface NearbySearch {
  lat: number;
  lng: number;
  query?: string | null;
  category?: string | null;
  /** Only offers at or under this price are considered. */
  maxPrice?: number | null;
  limit: number;
  offset?: number;
}

/** Location-first retrieval: nothing outside the delivery radius of an online store is ever returned. */
export async function searchNearby(db: Db, s: NearbySearch) {
  const rawQuery = s.query?.trim() || null;
  const searchLike = rawQuery ? `%${escapeLike(rawQuery)}%` : null;
  const queryVector = rawQuery ? await embedQuery(rawQuery) : null;
  const { rows } = await db.query(
    `with ${NEARBY_CTE},
     best as (
       ${bestOfferSelect({ columns: SEARCH_COLUMNS, joins: SEARCH_JOINS })}
         and ($3::text is null or p.category_id = $3)
         and ($10::numeric is null or i.price <= $10)
       order by p.id, (i.stock > 0) desc, n.km asc, i.price asc
     ),
     ranked as (
       select *, row_number() over (order by sem desc nulls last) as sem_rank from best
     )
     select * from ranked
      where $4::text is null or kw_match or (sem >= ${SEMANTIC_MIN} and sem_rank <= ${SEMANTIC_TOP})
      order by (stock > 0) desc, case when $4::text is null then 0 else "searchScore" end desc, name
      limit $6 offset $7`,
    [s.lat, s.lng, s.category ?? null, rawQuery, searchLike, s.limit, s.offset ?? 0,
      queryVector ? toPgVector(queryVector.vector) : null, queryVector?.model ?? null, s.maxPrice ?? null],
  );
  const products = rows.map((row) => {
    delete row.sem;
    delete row.kw_match;
    delete row.sem_rank;
    return withEta(row) as NearbyOffer;
  });
  return { products, searchMode: rawQuery ? (queryVector ? ('hybrid' as const) : ('keyword' as const)) : null };
}

export async function countNearbyStores(db: Db, lat: number, lng: number): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`with ${NEARBY_CTE} select count(*)::int as n from nearby`, [lat, lng]);
  return rows[0]?.n ?? 0;
}

/** The best nearby offer for one product, or null when no store in range lists it. */
export async function nearbyProduct(db: Db, lat: number, lng: number, productId: string): Promise<NearbyOffer | null> {
  const { rows } = await db.query(
    `with ${NEARBY_CTE}
     ${BEST_OFFER_SELECT} and p.id = $3
     order by p.id, (i.stock > 0) desc, n.km asc, i.price asc`,
    [lat, lng, productId],
  );
  return rows[0] ? (withEta(rows[0]) as NearbyOffer) : null;
}
