'use client';

import { useEffect, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
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

const FILTERS = {
  active: 'placed,accepted,packing,ready_for_pickup,out_for_delivery',
  done: 'delivered,cancelled',
} as const;

export function OrdersPanel({ onChange }: { onChange: () => void }) {
  const [filter, setFilter] = useState<keyof typeof FILTERS>('active');
  const [busy, setBusy] = useState<string | null>(null);
  const orders = useLoad(
    () => api<{ orders: Order[] }>(`/vendor/orders?status=${FILTERS[filter]}`).then((r) => r.orders),
    [filter],
  );

  useEffect(() => {
    if (filter !== 'active') return;
    const timer = setInterval(() => void orders.reload(), 15_000);
    return () => clearInterval(timer);
  }, [filter, orders.reload]);

  const transition = async (order: Order, to: OrderStatus) => {
    const body: { to: OrderStatus; otp?: string; reason?: string } = { to };
    if (to === 'delivered') {
      const otp = prompt(`Ask the customer for the 4-digit delivery code for order #${order.orderNumber}`);
      if (!otp) return;
      body.otp = otp.trim();
    }
    if (to === 'cancelled') {
      const reason = prompt('Why are you cancelling? The customer will be refunded.');
      if (!reason || reason.trim().length < 3) return;
      body.reason = reason.trim();
    }
    setBusy(order.id);
    try {
      await api(`/vendor/orders/${order.id}/transition`, { method: 'POST', body });
      await orders.reload();
      onChange();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

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
          </button>
        ))}
        <button onClick={orders.reload} className="ml-auto text-xs font-semibold text-slate-600 underline">
          Refresh
        </button>
      </div>

      {orders.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{orders.error}</p>}
      {orders.data?.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No orders here.</p>}

      {orders.data?.map((order) => {
        const next = NEXT_STEP[order.status];
        return (
          <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">
                  #{order.orderNumber} · {ORDER_STATUS_LABEL[order.status]}
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
            <div className="mt-3 flex gap-2">
              {next && (
                <button
                  disabled={busy === order.id}
                  onClick={() => transition(order, next.to)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {next.label}
                </button>
              )}
              {VENDOR_CAN_CANCEL.includes(order.status) && (
                <button
                  disabled={busy === order.id}
                  onClick={() => transition(order, 'cancelled')}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
