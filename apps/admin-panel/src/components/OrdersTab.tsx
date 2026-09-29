'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { formatDateTime, formatInr, ORDER_STATUS_LABEL } from '@spaceborn/web-core/format';
import type { Order, OrderStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const FILTERS: { label: string; statuses: OrderStatus[] | null }[] = [
  { label: 'Active', statuses: ['placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'] },
  { label: 'Delivered', statuses: ['delivered'] },
  { label: 'Cancelled', statuses: ['cancelled', 'expired'] },
  { label: 'All', statuses: null },
];

const CANCELLABLE: OrderStatus[] = ['pending_payment', 'placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'];

export function OrdersTab() {
  const [filter, setFilter] = useState(FILTERS[0]!);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = filter.statuses ? `?status=${filter.statuses.join(',')}` : '';
  const { data, error, loading, reload } = useLoad(
    () => api<{ orders: Order[] }>(`/admin/orders${query}`).then((r) => r.orders),
    [query],
  );

  const cancel = async (order: Order) => {
    const reason = window.prompt(`Cancel order #${order.orderNumber}? Reason (a refund is issued if paid):`);
    if (!reason || reason.trim().length < 3) return;
    setActionError(null);
    try {
      await api(`/admin/orders/${order.id}/cancel`, { method: 'POST', body: { reason: reason.trim() } });
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter.label === f.label ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(error || actionError) && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error || actionError}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Store</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono">#{order.orderNumber}</td>
                <td className="px-3 py-2">{order.storeName}</td>
                <td className="px-3 py-2">{ORDER_STATUS_LABEL[order.status]}</td>
                <td className="px-3 py-2 capitalize">{order.paymentStatus?.replace('_', ' ') ?? '—'}</td>
                <td className="px-3 py-2 text-right">{formatInr(order.grandTotal)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(order.createdAt)}</td>
                <td className="px-3 py-2 text-right">
                  {CANCELLABLE.includes(order.status) && (
                    <button onClick={() => cancel(order)} className="text-xs font-semibold text-red-700 hover:underline">
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.length === 0 && <p className="p-4 text-sm text-slate-500">No orders.</p>}
      </div>
    </div>
  );
}
