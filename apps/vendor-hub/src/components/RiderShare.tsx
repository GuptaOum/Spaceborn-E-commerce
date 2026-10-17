'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import type { Order } from '@spaceborn/web-core/types';

// Your shop delivers its own orders. Whoever carries the parcel opens this order on their phone and
// taps "Share my location"; the customer's order page then shows them on a map until the handover.
// Positions go to the API only while sharing is on, a few times a minute, never in the background.

const MIN_SEND_MS = 8_000;
const MIN_MOVE_M = 25;
const RETRY_MS = 15_000;

interface Ack {
  remainingKm: number;
  etaMinutes: number;
  at: string;
}

const metres = (a: GeolocationCoordinates, b: GeolocationCoordinates) => {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
};

const STORAGE_KEY = 'sb:sharing-order';

export function RiderShare({ order }: { order: Order }) {
  const [sharing, setSharing] = useState(false);
  const [ack, setAck] = useState<Ack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const watch = useRef<number | null>(null);
  const lastSent = useRef<{ at: number; coords: GeolocationCoordinates } | null>(null);
  const inFlight = useRef(false);
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const stop = () => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === order.id) sessionStorage.removeItem(STORAGE_KEY);
  };

  const send = async (coords: GeolocationCoordinates, force = false) => {
    const t = Date.now();
    const prev = lastSent.current;
    if (!force && prev && t - prev.at < MIN_SEND_MS) return;
    if (!force && prev && metres(prev.coords, coords) < MIN_MOVE_M && t - prev.at < 60_000) return;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const r = await api<Ack>(`/vendor/orders/${order.id}/location`, {
        method: 'POST',
        body: { lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)) },
      });
      lastSent.current = { at: t, coords };
      setAck(r);
      setError(null);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      // 409: the order is no longer on the road. Nothing more to share.
      if (e.status === 409) stop();
      setError(e.message ?? 'Could not send location');
      lastSent.current = { at: t - MIN_SEND_MS + RETRY_MS, coords };
    } finally {
      inFlight.current = false;
    }
  };

  const start = () => {
    if (!supported) {
      setError('This browser cannot share location. Open the hub on the rider\u2019s phone.');
      return;
    }
    setError(null);
    setSharing(true);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_KEY, order.id);
    watch.current = navigator.geolocation.watchPosition(
      (pos) => void send(pos.coords, !lastSent.current),
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? 'Location permission was refused. Allow it in the browser to share.' : 'Waiting for a GPS fix\u2026');
        if (err.code === err.PERMISSION_DENIED) stop();
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  };

  // Resume only on the phone that already tapped share. Dispatching from the counter must not start GPS there.
  useEffect(() => {
    const resume = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === order.id;
    if (resume && !sharing && order.status === 'out_for_delivery') start();
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.status]);

  useEffect(() => {
    if (!sharing) return;
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(tick);
  }, [sharing]);

  if (order.status !== 'out_for_delivery') return null;

  const addr = order.deliveryAddress;
  const directions =
    addr.latitude != null && addr.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}&travelmode=two-wheeler`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${addr.line1}, ${addr.city} ${addr.pincode}`)}`;
  const ago = lastSent.current ? Math.round((now - lastSent.current.at) / 1000) : null;

  return (
    <div className="mt-2.5 rounded-lg border border-indigo-200 bg-indigo-50 p-2.5 text-xs text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-900">Your rider&rsquo;s live location</span>
          <p className="mt-0.5 text-slate-600">
            {sharing
              ? ack
                ? `Sharing \u00b7 ${ack.remainingKm.toFixed(1)} km to the customer, about ${ack.etaMinutes} min${ago != null ? ` \u00b7 sent ${ago}s ago` : ''}`
                : 'Sharing \u00b7 waiting for the first GPS fix\u2026'
              : 'Open this on the phone that goes with the parcel, signed into this store’s Seller Hub, and tap share. The customer sees that phone on a map.'}
          </p>
          {error && <p className="mt-0.5 text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2">
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Directions
          </a>
          {sharing ? (
            <button type="button" onClick={stop} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-100">
              Stop sharing
            </button>
          ) : (
            <button type="button" onClick={start} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500">
              Share my location
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
