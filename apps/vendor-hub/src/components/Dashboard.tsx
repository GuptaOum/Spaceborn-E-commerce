'use client';

import { useEffect, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction } from '@spaceborn/web-core/feedback';
import { formatInr } from '@spaceborn/web-core/format';
import type { Store } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FabJobsPanel } from './FabJobsPanel';
import { InventoryPanel } from './InventoryPanel';
import { OrdersPanel } from './OrdersPanel';
import { ProductsPanel } from './ProductsPanel';
import { ServicesPanel } from './ServicesPanel';

type Tab = 'orders' | 'inventory' | 'products' | 'fab-jobs' | 'services';
const TABS: [Tab, string][] = [
  ['orders', 'Orders'],
  ['inventory', 'Inventory'],
  ['products', 'My products'],
  ['fab-jobs', 'Print jobs'],
  ['services', 'Services'],
];

interface Summary {
  awaitingAcceptance: number;
  inProgress: number;
  deliveredToday: number;
  revenueToday: number;
  lowStock: number;
  fabQuotesPending?: number;
  fabInProgress?: number;
}

function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // AudioContext might be blocked until user clicks
  }
}

const SUMMARY_REFRESH_MS = 20_000;

export function Dashboard({ initialStore }: { initialStore: Store }) {
  const [store, setStore] = useState(initialStore);
  const [tab, setTab] = useState<Tab>('orders');
  const summary = useLoad(() => api<{ summary: Summary }>('/vendor/summary').then((r) => r.summary), []);

  useEffect(() => {
    const timer = setInterval(() => void summary.refresh(), SUMMARY_REFRESH_MS);
    return () => clearInterval(timer);
  }, [summary.refresh]);

  useEffect(() => {
    if (!summary.data) return;
    const totalUrgent = (summary.data.awaitingAcceptance || 0) + (summary.data.fabQuotesPending || 0);
    if (totalUrgent > 0) {
      playNotificationChime();
    }
  }, [summary.data?.awaitingAcceptance, summary.data?.fabQuotesPending]);

  const [toggleOnline, toggling] = useAction(
    async () => {
      const wanted = !store.isOnline;
      setStore((s) => ({ ...s, isOnline: wanted })); // optimistic
      try {
        const r = await api<{ store: Store }>('/vendor/store', { method: 'PATCH', body: { isOnline: wanted } });
        setStore(r.store);
        return r.store.isOnline;
      } catch (err) {
        setStore((s) => ({ ...s, isOnline: !wanted }));
        throw err;
      }
    },
    { success: (online) => (online ? 'You are online. Customers nearby can order now.' : 'You are offline. New orders are paused.') },
  );

  const s = summary.data;
  const stats: [string, string | number | undefined, string?][] = [
    ['New orders', s?.awaitingAcceptance, s?.awaitingAcceptance ? 'text-amber-600 font-bold' : undefined],
    ['Quotes needed', s?.fabQuotesPending, s?.fabQuotesPending ? 'text-amber-600 font-bold' : undefined],
    ['In progress', (s?.inProgress ?? 0) + (s?.fabInProgress ?? 0)],
    ['Delivered today', s?.deliveredToday],
    ['Revenue today', s ? formatInr(s.revenueToday) : undefined],
  ];
  const badge: Partial<Record<Tab, number | undefined>> = {
    orders: s?.awaitingAcceptance,
    inventory: s?.lowStock,
    'fab-jobs': s?.fabQuotesPending,
  };

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <h1 className="text-xl font-bold">{store.name}</h1>
          <p className="text-sm text-slate-500">
            {store.city} · delivers within {store.deliveryRadiusKm} km · ~{store.prepMinutes} min prep
          </p>
        </div>
        <button
          onClick={() => void toggleOnline()}
          disabled={toggling}
          aria-pressed={store.isOnline}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white transition disabled:opacity-60 ${store.isOnline ? 'bg-emerald-600' : 'bg-slate-500'}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${store.isOnline ? 'bg-white' : 'bg-slate-300'}`} />
          {toggling ? 'Updating…' : store.isOnline ? 'Online — taking orders' : 'Offline — tap to go online'}
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-lg font-bold ${tone ?? ''}`}>{value ?? (summary.loading ? '…' : '—')}</p>
          </div>
        ))}
      </section>

      <nav className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {label}
            {badge[t] ? <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === t ? 'bg-white text-slate-900' : 'bg-amber-500 text-white'}`}>{badge[t]}</span> : null}
          </button>
        ))}
      </nav>

      {tab === 'orders' && <OrdersPanel onChange={summary.refresh} />}
      {tab === 'inventory' && <InventoryPanel onChange={summary.refresh} />}
      {tab === 'products' && <ProductsPanel />}
      {tab === 'fab-jobs' && <FabJobsPanel />}
      {tab === 'services' && <ServicesPanel store={store} />}
    </main>
  );
}
