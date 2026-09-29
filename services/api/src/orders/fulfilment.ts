import type { Db } from '../db/pool.js';
import { distanceSql } from '../lib/geo.js';
import { etaMinutes, priceOrder } from './pricing.js';

// ~30 km bounding box keeps the haversine off most rows before the radius check.
export const LAT_WINDOW = 0.27;

export interface Candidate {
  storeId: string;
  storeName: string;
  city: string;
  distanceKm: number;
  prepMinutes: number;
  coverable: number;
  itemsTotal: number;
}

export interface ResolvedLine {
  productId: string;
  quantity: number;
  unitPrice: number | null;
  available: number;
  ok: boolean;
}

export interface Resolution {
  store: { id: string; name: string; city: string; distanceKm: number; etaMinutes: number } | null;
  lines: ResolvedLine[];
  unavailable: string[];
  pricing: ReturnType<typeof priceOrder> | null;
  nearbyStores: number;
}

/**
 * Picks the store that fulfils the cart. The customer never chooses a vendor: every approved,
 * online store whose delivery radius covers the customer competes, and the winner is the one that
 * can supply the most lines, then the nearest, then the cheapest.
 */
export async function rankStores(db: Db, lat: number, lng: number, quantities: Map<string, number>): Promise<Candidate[]> {
  const ids = [...quantities.keys()];
  const qtys = ids.map((id) => quantities.get(id)!);
  const { rows } = await db.query(
    `with nearby as (
       select s.id, s.name, s.city, s.avg_prep_minutes, d.km
         from stores s
         cross join lateral (select ${distanceSql('$1', '$2')} as km) d
        where s.status = 'approved' and s.is_online
          and s.latitude between $1 - ${LAT_WINDOW} and $1 + ${LAT_WINDOW}
          and d.km <= s.delivery_radius_km
     ),
     wanted as (select * from unnest($3::uuid[], $4::int[]) as w(product_id, qty)),
     offers as (
       select i.store_id, i.product_id, i.price, i.stock, w.qty
         from inventory i
         join products p on p.id = i.product_id
         join wanted w on w.product_id = i.product_id
        where i.is_listed and p.is_active and i.stock >= w.qty
     )
     select n.id as "storeId", n.name as "storeName", n.city, n.km as "distanceKm", n.avg_prep_minutes as "prepMinutes",
            count(o.product_id)::int as coverable,
            coalesce(sum(o.price * o.qty), 0)::float as "itemsTotal"
       from nearby n
       left join offers o on o.store_id = n.id
      group by n.id, n.name, n.city, n.km, n.avg_prep_minutes
      order by coverable desc, n.km asc, "itemsTotal" asc
      limit 5`,
    [lat, lng, ids, qtys],
  );
  return rows as Candidate[];
}

export async function resolveCart(db: Db, lat: number, lng: number, quantities: Map<string, number>): Promise<Resolution> {
  const ranked = await rankStores(db, lat, lng, quantities);
  const best = ranked[0];
  if (!best) return { store: null, lines: [], unavailable: [...quantities.keys()], pricing: null, nearbyStores: 0 };

  const ids = [...quantities.keys()];
  const { rows } = await db.query<{ product_id: string; price: number; stock: number }>(
    `select i.product_id, i.price, i.stock
       from inventory i join products p on p.id = i.product_id
      where i.store_id = $1 and i.product_id = any($2::uuid[]) and i.is_listed and p.is_active`,
    [best.storeId, ids],
  );
  const byId = new Map(rows.map((r) => [r.product_id, r]));
  const lines: ResolvedLine[] = ids.map((productId) => {
    const row = byId.get(productId);
    const quantity = quantities.get(productId)!;
    return {
      productId,
      quantity,
      unitPrice: row ? Number(row.price) : null,
      available: row?.stock ?? 0,
      ok: Boolean(row && row.stock >= quantity),
    };
  });
  const okLines = lines.filter((l) => l.ok);
  const pricing = okLines.length ? priceOrder(okLines.map((l) => ({ unitPrice: l.unitPrice!, quantity: l.quantity })), best.distanceKm) : null;
  return {
    store: {
      id: best.storeId,
      name: best.storeName,
      city: best.city,
      distanceKm: Math.round(best.distanceKm * 10) / 10,
      etaMinutes: etaMinutes(best.prepMinutes, best.distanceKm),
    },
    lines,
    unavailable: lines.filter((l) => !l.ok).map((l) => l.productId),
    pricing,
    nearbyStores: ranked.length,
  };
}
