'use client';

import { api } from '@spaceborn/web-core/api';
import { GeoMap, type MapMarker } from '@spaceborn/web-core/geo-map';
import type { Store } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

// What customers near this shop asked the Spaceborn copilot for and nobody nearby could supply.
// Each row is a sale that did not happen within riding distance. Restock the top ones.

interface Signal {
  query: string;
  areaLabel: string | null;
  lat: number;
  lng: number;
  misses: number;
  lastSeen: string;
  distanceKm: number;
}

interface Demand {
  signals: Signal[];
  radiusKm: number;
  center: { lat: number; lng: number } | null;
}

const daysAgo = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

export function DemandPanel({ store }: { store: Store }) {
  const demand = useLoad(() => api<Demand>('/vendor/demand'), []);
  const data = demand.data;

  // Several queries share one 0.01° cell; one circle per cell, weighted by all its misses.
  const cells = new Map<string, { lat: number; lng: number; misses: number; queries: string[] }>();
  for (const s of data?.signals ?? []) {
    const key = `${s.lat},${s.lng}`;
    const cell = cells.get(key) ?? { lat: s.lat, lng: s.lng, misses: 0, queries: [] };
    cell.misses += s.misses;
    if (cell.queries.length < 4) cell.queries.push(s.query);
    cells.set(key, cell);
  }
  const markers: MapMarker[] = [];
  if (data?.center) markers.push({ id: 'store', kind: 'store', lat: data.center.lat, lng: data.center.lng, label: store.name });
  for (const [key, cell] of cells) {
    markers.push({ id: key, kind: 'demand', lat: cell.lat, lng: cell.lng, weight: cell.misses, label: `${cell.misses} unmet: ${cell.queries.join(', ')}` });
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Unmet demand near you</h2>
        <p className="mt-1 text-sm text-slate-600">
          Customers inside your delivery radius ({data?.radiusKm ?? '—'} km) asked the Spaceborn copilot for these and no store close to them had stock. Each one is a sale
          that went nowhere. Stock the top rows and they come to you.
        </p>
      </div>

      {demand.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{demand.error}</p>}
      {demand.loading && <p className="p-6 text-center text-sm text-slate-400">Reading the last 30 days…</p>}

      {data && (
        <>
          {markers.length > 0 && (
            <GeoMap
              markers={markers}
              radius={data.center ? { markerId: 'store', metres: data.radiusKm * 1000 } : undefined}
              className="h-72 w-full overflow-hidden rounded-xl border border-slate-200"
            />
          )}

          {data.signals.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Nothing unmet in your area in the last 30 days. Customers nearby are finding what they ask for.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">What they asked for</th>
                    <th className="px-3 py-2">Times</th>
                    <th className="px-3 py-2">Where</th>
                    <th className="px-3 py-2">Last asked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.signals.map((s) => (
                    <tr key={`${s.query}-${s.lat}-${s.lng}`}>
                      <td className="px-3 py-2 font-semibold text-slate-900">{s.query}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">{s.misses}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {s.areaLabel ?? 'Nearby'} · {s.distanceKm.toFixed(1)} km
                      </td>
                      <td className="px-3 py-2 text-slate-500">{daysAgo(s.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
