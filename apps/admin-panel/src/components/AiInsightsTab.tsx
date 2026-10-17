'use client';

import { api } from '@spaceborn/web-core/api';
import { formatDateTime } from '@spaceborn/web-core/format';
import { useLoad } from '@spaceborn/web-core/use-load';
import { ListState } from './ui';

interface Insights {
  demand: { query: string; areaLabel: string | null; lat: number; lng: number; misses: number; lastSeen: string }[];
  usage: { day: string; mode: 'copilot' | 'fallback'; chats: number; answered: number; inputTokens: number; outputTokens: number; avgLatencyMs: number }[];
  funnel: { day: string; status: string; events: number }[];
}

const FUNNEL_ORDER = ['placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'expired'];

/** Built by the Kafka analytics consumer from the copilot and order event streams. */
export function AiInsightsTab() {
  const insights = useLoad(() => api<Insights>('/admin/ai/insights'), []);
  const data = insights.data;

  const num = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const totals = (data?.usage ?? []).reduce(
    (t, u) => ({
      chats: t.chats + num(u.chats),
      fallback: t.fallback + (u.mode === 'fallback' ? num(u.chats) : 0),
      tokens: t.tokens + num(u.inputTokens) + num(u.outputTokens),
      latency: t.latency + num(u.avgLatencyMs) * num(u.chats),
    }),
    { chats: 0, fallback: 0, tokens: 0, latency: 0 },
  );
  const funnel = new Map<string, number>();
  for (const f of data?.funnel ?? []) funnel.set(f.status, (funnel.get(f.status) ?? 0) + f.events);

  return (
    <ListState loading={insights.loading} error={insights.error} empty={null}>
      {data && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Copilot chats (14 days)', value: totals.chats.toLocaleString('en-IN') },
              { label: 'Answered by search fallback', value: totals.chats ? `${Math.round((totals.fallback / totals.chats) * 100)}%` : '—' },
              { label: 'Model tokens', value: totals.tokens.toLocaleString('en-IN') },
              { label: 'Average answer time', value: totals.chats ? `${(totals.latency / totals.chats / 1000).toFixed(1)} s` : '—' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{c.value}</p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="text-sm font-bold text-slate-800">Unmet demand</h2>
            <p className="text-xs text-slate-500">What customers asked the copilot for that no store within delivery range stocked. Worth sharing with vendors in that area.</p>
            {data.demand.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No unmet searches in the last 14 days.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1.5">Search</th>
                    <th>Area</th>
                    <th className="text-right">Times</th>
                    <th className="text-right">Last asked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.demand.map((d) => (
                    <tr key={`${d.query}-${d.lat}-${d.lng}`}>
                      <td className="py-1.5 font-medium text-slate-800">{d.query}</td>
                      <td className="text-slate-600">{d.areaLabel ?? `${d.lat}, ${d.lng}`}</td>
                      <td className="text-right font-mono">{d.misses}</td>
                      <td className="text-right text-xs text-slate-500">{formatDateTime(d.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-bold text-slate-800">Order events (14 days)</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {FUNNEL_ORDER.filter((s) => funnel.has(s)).map((s) => (
                <span key={s} className="rounded-lg bg-white px-3 py-1.5 text-xs ring-1 ring-slate-200">
                  <span className="capitalize text-slate-500">{s.replace(/_/g, ' ')}</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{funnel.get(s)}</span>
                </span>
              ))}
              {funnel.size === 0 && <p className="text-sm text-slate-500">No order events streamed yet.</p>}
            </div>
          </section>
        </div>
      )}
    </ListState>
  );
}
