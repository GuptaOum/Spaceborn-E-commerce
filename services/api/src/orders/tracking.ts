import { EventEmitter } from 'node:events';
import { cachePublish, cacheSubscribe } from '../cache.js';
import { pool, type Db } from '../db/pool.js';
import { conflict, notFound } from '../errors.js';
import { haversineKm } from '../lib/geo.js';
import { logger } from '../logger.js';
import { TERMINAL_STATUSES, type OrderStatus } from './status.js';

// Live delivery tracking. The store delivers its own orders, so "the rider" is whoever the shop
// sent out with the parcel, sharing their phone's position from the Seller Hub. The customer's
// page gets a map with the shop, their door, and that rider. Nothing here touches money or stock.

// A city rider on a two-wheeler, with stops and signals. Honest enough for "about 12 minutes".
const RIDER_KMPH = 18;
const MIN_ETA_MINUTES = 1;
// Store coordinates are rounded so a customer learns the neighbourhood, not the shop's exact door.
const ORIGIN_DECIMALS = 3;

export type TrackingEvent =
  | { type: 'status'; status: OrderStatus }
  | { type: 'position'; lat: number; lng: number; at: string; remainingKm: number; etaMinutes: number };

export interface TrackingSnapshot {
  orderId: string;
  status: OrderStatus;
  live: boolean;
  destination: { lat: number; lng: number } | null;
  origin: { lat: number; lng: number } | null;
  rider: { lat: number; lng: number; at: string; remainingKm: number; etaMinutes: number } | null;
}

const channel = (orderId: string) => `track:${orderId}`;

// Same-process fan-out. With Redis the message also comes back through the subscription, so a
// local listener is only used when publishing to Redis did not happen.
const local = new EventEmitter();
local.setMaxListeners(0);

export const etaMinutesFor = (km: number) => Math.max(MIN_ETA_MINUTES, Math.ceil((km / RIDER_KMPH) * 60));

const round = (n: number, decimals: number) => Number(n.toFixed(decimals));

export async function publishTracking(orderId: string, event: TrackingEvent) {
  const message = JSON.stringify(event);
  const shared = await cachePublish(channel(orderId), message);
  if (!shared) local.emit(channel(orderId), message);
}

/** Delivers events for one order until the returned function is called. */
export async function subscribeTracking(orderId: string, handler: (event: TrackingEvent) => void) {
  const onMessage = (raw: string) => {
    try {
      handler(JSON.parse(raw) as TrackingEvent);
    } catch (err) {
      logger.warn({ err, orderId }, 'bad tracking message');
    }
  };
  local.on(channel(orderId), onMessage);
  const unsubscribeRedis = await cacheSubscribe(channel(orderId), onMessage);
  return async () => {
    local.off(channel(orderId), onMessage);
    if (unsubscribeRedis) await unsubscribeRedis();
  };
}

interface TrackRow {
  id: string;
  status: OrderStatus;
  customer_id: string;
  store_id: string;
  dest_lat: number | null;
  dest_lng: number | null;
  store_lat: number | null;
  store_lng: number | null;
  rider_lat: number | null;
  rider_lng: number | null;
  rider_at: Date | null;
}

const TRACK_SELECT = `
  select o.id, o.status, o.customer_id, o.store_id,
         (o.delivery_address->>'latitude')::float8 as dest_lat,
         (o.delivery_address->>'longitude')::float8 as dest_lng,
         s.latitude::float8 as store_lat, s.longitude::float8 as store_lng,
         o.rider_lat::float8 as rider_lat, o.rider_lng::float8 as rider_lng, o.rider_at
    from orders o join stores s on s.id = o.store_id
   where o.id = $1`;

function toSnapshot(row: TrackRow): TrackingSnapshot {
  const destination = row.dest_lat != null && row.dest_lng != null ? { lat: row.dest_lat, lng: row.dest_lng } : null;
  const origin =
    row.store_lat != null && row.store_lng != null
      ? { lat: round(row.store_lat, ORIGIN_DECIMALS), lng: round(row.store_lng, ORIGIN_DECIMALS) }
      : null;
  let rider: TrackingSnapshot['rider'] = null;
  if (row.status === 'out_for_delivery' && row.rider_lat != null && row.rider_lng != null && row.rider_at) {
    const remainingKm = destination
      ? round(haversineKm(row.rider_lat, row.rider_lng, destination.lat, destination.lng), 2)
      : 0;
    rider = {
      lat: row.rider_lat,
      lng: row.rider_lng,
      at: row.rider_at.toISOString(),
      remainingKm,
      etaMinutes: etaMinutesFor(remainingKm),
    };
  }
  return {
    orderId: row.id,
    status: row.status,
    live: !TERMINAL_STATUSES.includes(row.status),
    destination,
    origin,
    rider,
  };
}

/** What the customer who placed the order may see right now. 404 for anyone else. */
export async function trackingSnapshot(orderId: string, customerId: string, db: Db = pool): Promise<TrackingSnapshot> {
  const { rows } = await db.query<TrackRow>(TRACK_SELECT, [orderId]);
  const row = rows[0];
  if (!row || row.customer_id !== customerId) throw notFound('Order not found');
  return toSnapshot(row);
}

/**
 * The shop's rider reports where they are. Accepted only while the parcel is on the road, and only
 * from the store that owns the order; anything else is a 409 or 404 so a stale app cannot move a
 * marker on a finished order.
 */
export async function recordRiderPosition(orderId: string, storeId: string, lat: number, lng: number) {
  const { rows } = await pool.query<TrackRow>(
    `update orders
        set rider_lat = $3, rider_lng = $4, rider_at = now()
      where id = $1 and store_id = $2 and status = 'out_for_delivery'
      returning id`,
    [orderId, storeId, lat, lng],
  );
  if (rows.length === 0) {
    const { rows: existing } = await pool.query<{ status: OrderStatus }>(
      `select status from orders where id = $1 and store_id = $2`,
      [orderId, storeId],
    );
    const current = existing[0];
    if (!current) throw notFound('Order not found');
    throw conflict(`Location is only shared while the order is out for delivery (it is ${current.status})`);
  }
  const { rows: full } = await pool.query<TrackRow>(TRACK_SELECT, [orderId]);
  const row = full[0];
  if (!row) throw notFound('Order not found');
  const snapshot = toSnapshot(row);
  const rider = snapshot.rider!;
  await publishTracking(orderId, { type: 'position', ...rider });
  return { remainingKm: rider.remainingKm, etaMinutes: rider.etaMinutes, at: rider.at };
}
