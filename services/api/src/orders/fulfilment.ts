import type { Db } from '../db/pool.js';
import { distanceSql } from '../lib/geo.js';
import { deliveryFee, etaMinutes, PLATFORM_FEE, priceOrder } from './pricing.js';

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
  /** How many stores will dispatch. More than one means the cart is split, nearest first. */
  deliveries?: number;
  /** Which shop sends which items, nearest first. Empty until the whole cart can be filled. */
  dispatches: Dispatch[];
}

export interface Dispatch {
  storeName: string;
  addressLine: string;
  city: string;
  pincode: string;
  distanceKm: number;
  etaMinutes: number;
  items: { productId: string; quantity: number }[];
}

export interface SliceLine {
  productId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
}

export interface StoreSlice {
  storeId: string;
  storeName: string;
  addressLine: string;
  city: string;
  pincode: string;
  distanceKm: number;
  prepMinutes: number;
  lines: SliceLine[];
}

interface OfferRow {
  store_id: string;
  store_name: string;
  address_line: string;
  city: string;
  pincode: string;
  km: number;
  prep: number;
  product_id: string;
  price: number;
  stock: number;
  name: string;
  sku: string;
  image_url: string | null;
}

/** Take each line from the nearest store that still has stock, then the next nearest. */
export async function allocateNearest(
  db: Db,
  lat: number,
  lng: number,
  quantities: Map<string, number>,
): Promise<{ slices: StoreSlice[]; short: { productId: string; wanted: number; available: number }[] }> {
  const ids = [...quantities.keys()];
  const { rows } = await db.query<OfferRow>(
    `select s.id as store_id, s.name as store_name, s.address_line, s.city, s.pincode, d.km, s.avg_prep_minutes as prep,
            i.product_id, i.price, i.stock, p.name, p.sku, p.image_url
       from stores s
       cross join lateral (select ${distanceSql('$1', '$2')} as km) d
       join inventory i on i.store_id = s.id
       join products p on p.id = i.product_id
      where s.status = 'approved' and s.is_online
        and s.latitude between $1 - ${LAT_WINDOW} and $1 + ${LAT_WINDOW}
        and d.km <= s.delivery_radius_km
        and i.is_listed and p.is_active and i.stock > 0
        and i.product_id = any($3::uuid[])
      order by i.product_id, d.km asc, i.price asc`,
    [lat, lng, ids],
  );

  const byStore = new Map<string, StoreSlice>();
  const left = new Map(quantities);
  for (const row of rows) {
    const need = left.get(row.product_id) ?? 0;
    if (need <= 0) continue;
    const take = Math.min(need, row.stock);
    if (take <= 0) continue;
    left.set(row.product_id, need - take);
    let slice = byStore.get(row.store_id);
    if (!slice) {
      slice = {
        storeId: row.store_id,
        storeName: row.store_name,
        addressLine: row.address_line,
        city: row.city,
        pincode: row.pincode,
        distanceKm: Number(row.km),
        prepMinutes: row.prep,
        lines: [],
      };
      byStore.set(row.store_id, slice);
    }
    slice.lines.push({
      productId: row.product_id,
      name: row.name,
      sku: row.sku,
      imageUrl: row.image_url,
      unitPrice: Number(row.price),
      quantity: take,
    });
  }

  const short = [...left.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({
      productId,
      wanted: quantities.get(productId)!,
      available: quantities.get(productId)! - qty,
    }));

  const slices = [...byStore.values()].sort((a, b) => a.distanceKm - b.distanceKm);
  return { slices, short };
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
 * Pooled stock for each product across every nearby store: the same number the catalog shows the
 * customer, so a shortfall message never claims less exists than the page advertised.
 */
export async function availabilityNearby(db: Db, lat: number, lng: number, productIds: string[]): Promise<Map<string, number>> {
  const { rows } = await db.query<{ product_id: string; stock: number }>(
    `with ${NEARBY}
     select i.product_id, sum(i.stock)::int as stock
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
    return { store: null, lines: [], unavailable: [...quantities.keys()], elsewhere: [], pricing: null, nearbyStores: 0, dispatches: [] };
  }

  // Same nearest-first split the order uses, so the total on screen is the total that gets charged.
  const alloc = await allocateNearest(db, lat, lng, quantities);
  if (!alloc.short.length && alloc.slices.length > 0) return resolutionFromSlices(alloc.slices);

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
    deliveries: 1,
    dispatches: [],
  };
}

function resolutionFromSlices(slices: StoreSlice[]): Resolution {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  let itemsTotal = 0;
  let fee = 0;
  const lines: ResolvedLine[] = [];
  for (const slice of slices) {
    const sliceItems = round2(slice.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
    itemsTotal += sliceItems;
    fee += deliveryFee(sliceItems, slice.distanceKm);
    for (const line of slice.lines) {
      const existing = lines.find((l) => l.productId === line.productId);
      if (existing) {
        // One line on screen for a product that ships from two shops: show the average paise.
        const nextQty = existing.quantity + line.quantity;
        existing.unitPrice = round2((existing.unitPrice! * existing.quantity + line.unitPrice * line.quantity) / nextQty);
        existing.quantity = nextQty;
        existing.available += line.quantity;
      } else {
        lines.push({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          available: line.quantity,
          ok: true,
        });
      }
    }
  }
  const nearest = slices[0]!;
  return {
    store: {
      id: nearest.storeId,
      name: nearest.storeName,
      city: nearest.city,
      distanceKm: Math.round(nearest.distanceKm * 10) / 10,
      etaMinutes: etaMinutes(nearest.prepMinutes, nearest.distanceKm),
    },
    lines,
    unavailable: [],
    elsewhere: [],
    pricing: {
      itemsTotal: round2(itemsTotal),
      deliveryFee: round2(fee),
      platformFee: PLATFORM_FEE,
      grandTotal: round2(itemsTotal + fee + PLATFORM_FEE),
    },
    nearbyStores: slices.length,
    deliveries: slices.length,
    dispatches: slices.map((slice) => ({
      storeName: slice.storeName,
      addressLine: slice.addressLine,
      city: slice.city,
      pincode: slice.pincode,
      distanceKm: Math.round(slice.distanceKm * 10) / 10,
      etaMinutes: etaMinutes(slice.prepMinutes, slice.distanceKm),
      items: slice.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    })),
  };
}
