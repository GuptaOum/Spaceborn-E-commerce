'use client';

import { api } from '@spaceborn/web-core/api';
import { formatInr } from '@spaceborn/web-core/format';
import { useLoad } from '@spaceborn/web-core/use-load';

interface OverviewData {
  pendingStores: number;
  approvedStores: number;
  onlineStores: number;
  activeProducts: number;
  ordersToday: number;
  gmvToday: number;
  refundsPending: number;
  pendingServices: number;
  activeFabJobs: number;
}

export function Overview() {
  const { data } = useLoad(() => api<{ overview: OverviewData }>('/admin/overview').then((r) => r.overview), []);
  const cards = data
    ? [
        ['Pending applications', data.pendingStores],
        ['Stores online', `${data.onlineStores} / ${data.approvedStores}`],
        ['Active products', data.activeProducts],
        ['Orders today', data.ordersToday],
        ['Delivered GMV today', formatInr(data.gmvToday)],
        ['Refunds pending', data.refundsPending],
        ['Services to review', data.pendingServices],
        ['Active print jobs', data.activeFabJobs],
      ]
    : [];

  return (
    <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-bold">{value}</p>
        </div>
      ))}
    </section>
  );
}
