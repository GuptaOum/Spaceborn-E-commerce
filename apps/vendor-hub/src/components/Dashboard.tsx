'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { formatInr } from '@spaceborn/web-core/format';
import type { Store } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FabJobsPanel } from './FabJobsPanel';
import { InventoryPanel } from './InventoryPanel';
import { OrdersPanel } from './OrdersPanel';
import { ServicesPanel } from './ServicesPanel';

type Tab = 'orders' | 'inventory' | 'fab-jobs' | 'services';
const TABS: [Tab, string][] = [
  ['orders', 'Orders'],
  ['inventory', 'Inventory'],
  ['fab-jobs', 'Print jobs'],
  ['services', 'Services'],
];

interface Summary {
  awaitingAcceptance: number;
  inProgress: number;
  deliveredToday: number;
  revenueToday: number;
  lowStock: number;
}

export function Dashboard({ initialStore }: { initialStore: Store }) {
  const [store, setStore] = useState(initialStore);
  const [tab, setTab] = useState<Tab>('orders');
  const [toggling, setToggling] = useState(false);
  const summary = useLoad(() => api<{ summary: Summary }>('/vendor/summary').then((r) => r.summary), []);

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const r = await api<{ store: Store }>('/vendor/store', { method: 'PATCH', body: { isOnline: !store.isOnline } });
      setStore(r.store);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setToggling(false);
    }
  };

  const s = summary.data;
  const stats = [
    ['New orders', s?.awaitingAcceptance],
    ['In progress', s?.inProgress],
    ['Delivered today', s?.deliveredToday],
    ['Revenue today', s ? formatInr(s.revenueToday) : undefined],
    ['Low stock', s?.lowStock],
  ] as const;

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
          onClick={toggleOnline}
          disabled={toggling}
          className={`rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${store.isOnline ? 'bg-emerald-600' : 'bg-slate-500'}`}
        >
          {store.isOnline ? 'Online — taking orders' : 'Offline — tap to go online'}
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-bold">{value ?? '—'}</p>
          </div>
        ))}
      </section>

      <nav className="flex flex-wrap gap-2">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'orders' && <OrdersPanel onChange={summary.reload} />}
      {tab === 'inventory' && <InventoryPanel onChange={summary.reload} />}
      {tab === 'fab-jobs' && <FabJobsPanel />}
      {tab === 'services' && <ServicesPanel />}
    </main>
  );
}
