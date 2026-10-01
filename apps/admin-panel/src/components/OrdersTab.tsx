'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime, formatInr, ORDER_STATUS_LABEL } from '@spaceborn/web-core/format';
import type { Order, OrderStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FilterChips, ListState } from './ui';

const FILTERS = ['active', 'delivered', 'cancelled', 'all'] as const;
type Filter = (typeof FILTERS)[number];
const STATUSES: Record<Filter, OrderStatus[] | null> = {
  active: ['placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'],
  delivered: ['delivered'],
  cancelled: ['cancelled', 'expired'],
  all: null,
};

const CANCELLABLE: OrderStatus[] = ['pending_payment', 'placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'];

const TONE: Partial<Record<OrderStatus, string>> = {
  placed: 'text-amber-700',
  delivered: 'text-emerald-700',
  cancelled: 'text-red-700',
  expired: 'text-red-700',
};

export function OrdersTab() {
  const { prompt } = useFeedback();
  const [filter, setFilter] = useState<Filter>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = STATUSES[filter] ? `?status=${STATUSES[filter]!.join(',')}` : '';
  const orders = useLoad(() => api<{ orders: Order[] }>(`/admin/orders${query}`).then((r) => r.orders), [query]);

  const [cancel] = useAction(
    async (order: Order) => {
      const reason = await prompt({
        title: `Cancel order #${order.orderNumber}?`,
        body: `${order.storeName} and the customer both see this reason. A paid order is refunded.`,
        label: 'Reason',
        minLength: 3,
        multiline: true,
        confirmLabel: 'Cancel order',
        danger: true,
      });
      if (!reason) return '';
      setBusyId(order.id);
      try {
        const r = await api<{ order: Order }>(`/admin/orders/${order.id}/cancel`, { method: 'POST', body: { reason } });
        orders.mutate((list) => {
          if (!list) return list;
          const keep = filter === 'all' || filter === 'cancelled';
          return keep ? list.map((o) => (o.id === order.id ? { ...o, ...r.order } : o)) : list.filter((o) => o.id !== order.id);
        });
        return `Order #${order.orderNumber} cancelled`;
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <button onClick={() => void orders.refresh()} disabled={orders.refreshing} className="ml-auto text-xs font-semibold text-slate-600 underline disabled:opacity-50">
          {orders.refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <ListState loading={orders.loading} error={orders.error} empty={null}>
        {!orders.loading && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Store</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {orders.data?.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono">#{order.orderNumber}</td>
                    <td className="px-3 py-2">{order.storeName}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {order.deliveryAddress.fullName}
                      <span className="block text-slate-400">{order.deliveryAddress.pincode}</span>
                    </td>
                    <td className={`px-3 py-2 font-semibold ${TONE[order.status] ?? ''}`}>{ORDER_STATUS_LABEL[order.status]}</td>
                    <td className="px-3 py-2 capitalize">{order.paymentStatus?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{formatInr(order.grandTotal)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(order.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      {CANCELLABLE.includes(order.status) && (
                        <button disabled={busyId === order.id} onClick={() => void cancel(order)} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">
                          {busyId === order.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.data?.length === 0 && <p className="p-4 text-sm text-slate-500">No {filter === 'all' ? '' : filter} orders.</p>}
          </div>
        )}
      </ListState>
    </div>
  );
}
