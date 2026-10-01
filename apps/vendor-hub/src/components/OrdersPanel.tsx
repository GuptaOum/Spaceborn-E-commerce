'use client';

import { useEffect, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime, formatInr, ORDER_STATUS_LABEL } from '@spaceborn/web-core/format';
import type { Order, OrderStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  placed: { to: 'accepted', label: 'Accept' },
  accepted: { to: 'packing', label: 'Start packing' },
  packing: { to: 'ready_for_pickup', label: 'Ready for pickup' },
  ready_for_pickup: { to: 'out_for_delivery', label: 'Hand to rider' },
  out_for_delivery: { to: 'delivered', label: 'Mark delivered' },
};

const VENDOR_CAN_CANCEL: OrderStatus[] = ['placed', 'accepted', 'packing'];
const ACTIVE_STATUSES: OrderStatus[] = ['placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'];

const FILTERS = {
  active: 'placed,accepted,packing,ready_for_pickup,out_for_delivery',
  done: 'delivered,cancelled',
} as const;

const STATUS_TONE: Partial<Record<OrderStatus, string>> = {
  placed: 'bg-amber-100 text-amber-800',
  accepted: 'bg-sky-100 text-sky-800',
  packing: 'bg-sky-100 text-sky-800',
  ready_for_pickup: 'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function OrdersPanel({ onChange }: { onChange: () => void }) {
  const { prompt } = useFeedback();
  const [filter, setFilter] = useState<keyof typeof FILTERS>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const orders = useLoad(() => api<{ orders: Order[] }>(`/vendor/orders?status=${FILTERS[filter]}`).then((r) => r.orders), [filter]);

  useEffect(() => {
    if (filter !== 'active') return;
    const timer = setInterval(() => void orders.refresh(), 15_000);
    return () => clearInterval(timer);
  }, [filter, orders.refresh]);

  const replace = (next: Order) =>
    orders.mutate((list) => {
      if (!list) return list;
      // An order that left the current filter disappears from the list right away.
      const stillHere = filter === 'active' ? ACTIVE_STATUSES.includes(next.status) : !ACTIVE_STATUSES.includes(next.status);
      return stillHere ? list.map((o) => (o.id === next.id ? next : o)) : list.filter((o) => o.id !== next.id);
    });

  const [transition] = useAction(
    async (order: Order, to: OrderStatus) => {
      const body: { to: OrderStatus; otp?: string; reason?: string } = { to };
      if (to === 'delivered') {
        const otp = await prompt({
          title: `Deliver order #${order.orderNumber}`,
          body: `Ask ${order.deliveryAddress.fullName} for the 4-digit delivery code.`,
          label: 'Delivery code',
          placeholder: '1234',
          minLength: 4,
          confirmLabel: 'Mark delivered',
        });
        if (!otp) return '';
        body.otp = otp;
      }
      if (to === 'cancelled') {
        const reason = await prompt({
          title: `Cancel order #${order.orderNumber}?`,
          body: 'The customer is refunded in full and sees your reason.',
          label: 'Reason',
          minLength: 3,
          multiline: true,
          confirmLabel: 'Cancel order',
          danger: true,
        });
        if (!reason) return '';
        body.reason = reason;
      }
      setBusyId(order.id);
      try {
        const r = await api<{ order: Order }>(`/vendor/orders/${order.id}/transition`, { method: 'POST', body });
        replace(r.order);
        onChange();
        return `#${order.orderNumber} ${ORDER_STATUS_LABEL[r.order.status].toLowerCase()}`;
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            {f}
            {f === filter && orders.data && <span className="ml-1 text-slate-300">{orders.data.length}</span>}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filter === 'active' ? 'Updates every 15 s' : ''}</span>
        <button onClick={() => void orders.refresh()} disabled={orders.refreshing} className="text-xs font-semibold text-slate-600 underline disabled:opacity-50">
          {orders.refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {orders.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{orders.error}</p>}
      {orders.loading && <p className="p-6 text-center text-sm text-slate-400">Loading orders…</p>}
      {orders.data?.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{filter === 'active' ? 'No open orders right now.' : 'No completed orders yet.'}</p>}

      {orders.data?.map((order) => {
        const next = NEXT_STEP[order.status];
        const busy = busyId === order.id;
        return (
          <article key={order.id} className={`rounded-xl border bg-white p-4 ${order.status === 'placed' ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-bold">
                  #{order.orderNumber}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[order.status] ?? 'bg-slate-100 text-slate-700'}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(order.placedAt ?? order.createdAt)} · {order.distanceKm.toFixed(1)} km ·{' '}
                  {order.deliveryAddress.fullName}, {order.deliveryAddress.line1}, {order.deliveryAddress.pincode}
                </p>
              </div>
              <p className="font-bold">{formatInr(order.itemsTotal)}</p>
            </div>
            <ul className="mt-2 text-sm text-slate-700">
              {order.items.map((item) => (
                <li key={item.productId}>
                  {item.quantity} × {item.name} <span className="text-xs text-slate-400">({item.sku})</span>
                </li>
              ))}
            </ul>
            {order.cancelReason && <p className="mt-2 text-xs text-red-600">Cancelled: {order.cancelReason}</p>}
            {(next || VENDOR_CAN_CANCEL.includes(order.status)) && (
              <div className="mt-3 flex gap-2">
                {next && (
                  <button
                    disabled={busy}
                    onClick={() => void transition(order, next.to)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? 'Working…' : next.label}
                  </button>
                )}
                {VENDOR_CAN_CANCEL.includes(order.status) && (
                  <button
                    disabled={busy}
                    onClick={() => void transition(order, 'cancelled')}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
