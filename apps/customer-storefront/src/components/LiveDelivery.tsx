'use client';

import { useEffect, useRef, useState } from 'react';
import { streamServerEvents } from '@spaceborn/web-core/api';
import { GeoMap, type MapMarker } from '@spaceborn/web-core/geo-map';
import type { OrderStatus } from '@spaceborn/web-core/types';
import { Bike, RadioTower } from 'lucide-react';

interface Rider {
  lat: number;
  lng: number;
  at: string;
  remainingKm: number;
  etaMinutes: number;
}

interface Snapshot {
  orderId: string;
  status: OrderStatus;
  live: boolean;
  destination: { lat: number; lng: number } | null;
  origin: { lat: number; lng: number } | null;
  rider: Rider | null;
}

const RECONNECT_MS = 5_000;

// The store delivers its own orders. Once the parcel leaves, whoever the shop sent out shares
// their position from the Seller Hub and this map follows them to the customer's door.
export function LiveDelivery({ orderId, status, onStatusChange }: { orderId: string; status: OrderStatus; onStatusChange: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastStatus = useRef<OrderStatus>(status);

  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        for await (const frame of streamServerEvents<Snapshot | Rider | { status: OrderStatus }>(`/orders/${orderId}/track`, {}, abort.signal)) {
          setConnected(true);
          if (frame.event === 'snapshot') {
            const next = frame.data as Snapshot;
            setSnapshot(next);
            if (next.status !== lastStatus.current) {
              lastStatus.current = next.status;
              onStatusChange();
            }
          } else if (frame.event === 'position') {
            setSnapshot((prev) => (prev ? { ...prev, rider: frame.data as Rider } : prev));
          } else if (frame.event === 'status') {
            const next = (frame.data as { status: OrderStatus }).status;
            if (next !== lastStatus.current) {
              lastStatus.current = next;
              onStatusChange();
            }
          }
        }
      } catch {
        // fall through to reconnect
      }
      setConnected(false);
      if (!abort.signal.aborted) timer = setTimeout(() => void run(), RECONNECT_MS);
    };
    void run();

    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [orderId, onStatusChange]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(tick);
  }, []);

  if (!snapshot) return null;

  const markers: MapMarker[] = [];
  if (snapshot.origin) markers.push({ id: 'store', kind: 'store', lat: snapshot.origin.lat, lng: snapshot.origin.lng, label: 'Store' });
  if (snapshot.destination) markers.push({ id: 'home', kind: 'home', lat: snapshot.destination.lat, lng: snapshot.destination.lng, label: 'You' });
  if (snapshot.rider) markers.push({ id: 'rider', kind: 'rider', lat: snapshot.rider.lat, lng: snapshot.rider.lng, label: 'Rider' });

  const onRoad = status === 'out_for_delivery';
  const staleSeconds = snapshot.rider ? Math.max(0, Math.round((now - new Date(snapshot.rider.at).getTime()) / 1000)) : null;

  let line: string;
  if (status === 'delivered') line = 'Delivered. Thanks for ordering from a store near you.';
  else if (!onRoad) line = 'Being packed at the store. The map goes live when their rider leaves with your parcel.';
  else if (!snapshot.rider) line = 'Out for delivery. Waiting for the store\u2019s rider to share their location\u2026';
  else if (snapshot.rider.remainingKm < 0.15) line = 'The rider is at your door. Keep your handover code ready.';
  else line = `Rider is ${snapshot.rider.remainingKm.toFixed(1)} km away \u00b7 about ${snapshot.rider.etaMinutes} min`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-sb-ink">
          <Bike className="w-3.5 h-3.5 text-sb-brand" />
          <span>{line}</span>
        </span>
        {onRoad && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${connected ? 'text-sb-brand' : 'text-sb-muted'}`}>
            <RadioTower className="w-3 h-3" />
            {connected ? 'Live' : 'Reconnecting\u2026'}
            {staleSeconds != null && staleSeconds > 60 ? ` \u00b7 last seen ${Math.round(staleSeconds / 60)} min ago` : ''}
          </span>
        )}
      </div>
      {markers.length > 0 && status !== 'delivered' && (
        <GeoMap markers={markers} path={snapshot.rider ? ['rider', 'home'] : ['store', 'home']} className="h-56 w-full overflow-hidden rounded-xl border border-sb-line/60" />
      )}
      <p className="text-[11px] text-sb-muted">
        Delivered by the store&rsquo;s own rider, not a third-party courier. Location is shared only while your order is on the road.
      </p>
    </div>
  );
}
