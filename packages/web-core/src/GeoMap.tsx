'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';

// A small Leaflet map over OpenStreetMap tiles. No API key, no Google billing, and the library is
// loaded only on the client once a map is actually on screen. Markers are plain HTML so the icon
// image paths Leaflet expects from its CSS are never needed.
//
// Apps that render this must import 'leaflet/dist/leaflet.css' once (in their root layout).

export type MarkerKind = 'store' | 'home' | 'rider' | 'demand';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: MarkerKind;
  label?: string;
  /** For 'demand' circles: relative weight (1 = smallest). */
  weight?: number;
}

interface Props {
  markers: MapMarker[];
  /** Draw a line between these markers in order (e.g. store → rider → home). */
  path?: string[];
  /** Circle (metres) drawn around the marker with this id, e.g. a delivery radius. */
  radius?: { markerId: string; metres: number };
  className?: string;
  /** Refit the view when markers change. Off once the user has dragged or zoomed. */
  follow?: boolean;
}

const COLOURS: Record<MarkerKind, string> = {
  store: '#0f766e',
  home: '#1d4ed8',
  rider: '#ea580c',
  demand: '#9333ea',
};

const GLYPH: Record<MarkerKind, string> = {
  store: '🏬',
  home: '🏠',
  rider: '🛵',
  demand: '',
};

function iconFor(L: typeof Leaflet, marker: MapMarker) {
  if (marker.kind === 'demand') {
    return null;
  }
  const html = `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)">
      <div style="background:${COLOURS[marker.kind]};color:#fff;border-radius:9999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff">${GLYPH[marker.kind]}</div>
      ${marker.label ? `<div style="margin-top:2px;background:#fff;color:#111;border-radius:6px;padding:1px 6px;font:600 11px system-ui;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3)">${escapeHtml(marker.label)}</div>` : ''}
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [34, 34], iconAnchor: [17, 28] });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function GeoMap({ markers, path = [], radius, className, follow = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const userMoved = useRef(false);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('leaflet')
      .then((mod) => {
        if (cancelled || !host.current) return;
        const L = (mod.default ?? mod) as typeof Leaflet;
        leaflet.current = L;
        const m = L.map(host.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(m);
        m.setView([22.9734, 78.6569], 5); // India, until markers arrive
        m.on('dragstart zoomstart', () => {
          userMoved.current = true;
        });
        map.current = m;
        layer.current = L.layerGroup().addTo(m);
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    const group = layer.current;
    if (!ready || !L || !m || !group) return;
    group.clearLayers();
    const points = new Map<string, Leaflet.LatLngExpression>();
    const maxWeight = Math.max(1, ...markers.filter((k) => k.kind === 'demand').map((k) => k.weight ?? 1));
    for (const marker of markers) {
      const at: Leaflet.LatLngExpression = [marker.lat, marker.lng];
      points.set(marker.id, at);
      if (marker.kind === 'demand') {
        const scale = 0.35 + 0.65 * ((marker.weight ?? 1) / maxWeight);
        L.circle(at, { radius: 350 + 1100 * scale, color: COLOURS.demand, weight: 1, fillColor: COLOURS.demand, fillOpacity: 0.18 + 0.32 * scale })
          .bindTooltip(marker.label ?? '', { direction: 'top' })
          .addTo(group);
        continue;
      }
      const icon = iconFor(L, marker);
      if (icon) L.marker(at, { icon, zIndexOffset: marker.kind === 'rider' ? 1000 : 0 }).addTo(group);
    }
    if (radius) {
      const centre = points.get(radius.markerId);
      if (centre) L.circle(centre, { radius: radius.metres, color: COLOURS.store, weight: 1, fillOpacity: 0.05, dashArray: '4 4' }).addTo(group);
    }
    const line = path.map((id) => points.get(id)).filter((p): p is Leaflet.LatLngExpression => Boolean(p));
    if (line.length >= 2) L.polyline(line, { color: '#475569', weight: 3, dashArray: '6 6', opacity: 0.8 }).addTo(group);

    // First fit always happens; later refits only while following and the user has not taken over.
    const firstFit = !fitted.current;
    if (points.size > 0 && (firstFit || (follow && !userMoved.current))) {
      fitted.current = true;
      const bounds = L.latLngBounds([...points.values()]);
      if (radius) {
        const centre = points.get(radius.markerId);
        if (centre) bounds.extend(L.latLng(centre).toBounds(radius.metres * 2));
      }
      if (points.size === 1 && !radius) m.setView([...points.values()][0], 15);
      else m.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    }
  }, [markers, path, radius, ready, follow]);

  return (
    <div className={className ?? 'h-64 w-full overflow-hidden rounded-xl border border-zinc-200'}>
      {failed ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">Map could not load.</div>
      ) : (
        <div ref={host} className="h-full w-full" />
      )}
    </div>
  );
}
