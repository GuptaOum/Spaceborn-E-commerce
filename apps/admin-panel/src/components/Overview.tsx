'use client';

import { formatInr } from '@spaceborn/web-core/format';

export interface OverviewData {
  pendingStores: number;
  approvedStores: number;
  onlineStores: number;
  activeProducts: number;
  ordersToday: number;
  gmvToday: number;
  refundsPending: number;
  pendingServices: number;
  pendingProducts: number;
  activeFabJobs: number;
}

export function Overview({ data, onJump }: { data: OverviewData | null; onJump: (tab: 'stores' | 'services' | 'submissions' | 'orders' | 'fab-jobs') => void }) {
  const cards: { label: string; value: string | number; attention?: boolean; jump?: Parameters<typeof onJump>[0] }[] = data
    ? [
        { label: 'Pending applications', value: data.pendingStores, attention: data.pendingStores > 0, jump: 'stores' },
        { label: 'Services to review', value: data.pendingServices, attention: data.pendingServices > 0, jump: 'services' },
        { label: 'Products to review', value: data.pendingProducts, attention: data.pendingProducts > 0, jump: 'submissions' },
        { label: 'Stores online', value: `${data.onlineStores} / ${data.approvedStores}` },
        { label: 'Orders today', value: data.ordersToday, jump: 'orders' },
        { label: 'Delivered GMV today', value: formatInr(data.gmvToday) },
        { label: 'Refunds pending', value: data.refundsPending, attention: data.refundsPending > 0 },
        { label: 'Active print jobs', value: data.activeFabJobs, jump: 'fab-jobs' },
      ]
    : [];

  return (
    <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => {
        const inner = (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 text-lg font-bold ${c.attention ? 'text-amber-600' : ''}`}>{c.value}</p>
          </>
        );
        return c.jump ? (
          <button key={c.label} onClick={() => onJump(c.jump!)} className={`rounded-xl border bg-white p-3 text-left hover:border-slate-400 ${c.attention ? 'border-amber-300' : 'border-slate-200'}`}>
            {inner}
          </button>
        ) : (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-3">
            {inner}
          </div>
        );
      })}
      {!data && Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
    </section>
  );
}
