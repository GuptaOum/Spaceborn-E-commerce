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

/** Why a line can't come from the assigned store. `split_required` means another nearby store has it. */
export type LineProblem = 'unavailable' | 'insufficient_stock' | 'split_required';

export interface Resolution {
  store: { id: string; name: string; city: string; distanceKm: number; etaMinutes: number } | null;
  lines: ResolvedLine[];
  unavailable: string[];
  elsewhere: string[];
  pricing: ReturnType<typeof priceOrder> | null;
  nearbyStores: number;
}

const NEARBY = `
  nearby as (
    select s.id
      from stores s
      cross join lateral (select ${distanceSql('$1', '$2')} as km) d
     where s.status = 'approved' and s.is_online
       and s.latitude between $1 - ${LAT_WINDOW} and $1 + ${LAT_WINDOW}
       and d.km <= s.delivery_radius_km
  )`;

/**
 * Best single-store stock for each product across every nearby store. Lets us tell "nobody near you
 * has this" apart from "somebody has it, just not the store supplying the rest of your cart".
 */
export async function availabilityNearby(db: Db, lat: number, lng: number, productIds: string[]): Promise<Map<string, number>> {
  const { rows } = await db.query<{ product_id: string; stock: number }>(
    `with ${NEARBY}
     select i.product_id, max(i.stock)::int as stock
       from inventory i
       join nearby n on n.id = i.store_id
       join products p on p.id = i.product_id
      where i.is_listed and p.is_active and i.product_id = any($3::uuid[])
      group by i.product_id`,
    [lat, lng, productIds],
  );
  return new Map(rows.map((r) => [r.product_id, r.stock]));
}

/** Classifies every short line against what the wider neighbourhood can actually supply. */
export function classifyShortfall(
  quantities: Map<string, number>,
  fromStore: Map<string, number>,
  nearby: Map<string, number>,
): { productId: string; reason: LineProblem; available: number; availableNearby: number }[] {
  const out = [];
  for (const [productId, quantity] of quantities) {
    const available = fromStore.get(productId) ?? 0;
    if (available >= quantity) continue;
    const availableNearby = nearby.get(productId) ?? 0;
    const reason: LineProblem =
      availableNearby >= quantity ? 'split_required' : availableNearby > 0 ? 'insufficient_stock' : 'unavailable';
    out.push({ productId, reason, available, availableNearby });
  }
  return out;
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
  if (!best) {
    return { store: null, lines: [], unavailable: [...quantities.keys()], elsewhere: [], pricing: null, nearbyStores: 0 };
  }

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

  const short = lines.filter((l) => !l.ok);
  const nearby = short.length ? await availabilityNearby(db, lat, lng, short.map((l) => l.productId)) : new Map<string, number>();
  const problems = classifyShortfall(
    new Map(short.map((l) => [l.productId, l.quantity])),
    new Map(short.map((l) => [l.productId, l.available])),
    nearby,
  );

  return {
    store: {
      id: best.storeId,
      name: best.storeName,
      city: best.city,
      distanceKm: Math.round(best.distanceKm * 10) / 10,
      etaMinutes: etaMinutes(best.prepMinutes, best.distanceKm),
    },
    lines,
    unavailable: problems.filter((p) => p.reason !== 'split_required').map((p) => p.productId),
    elsewhere: problems.filter((p) => p.reason === 'split_required').map((p) => p.productId),
    pricing,
    nearbyStores: ranked.length,
  };
}
