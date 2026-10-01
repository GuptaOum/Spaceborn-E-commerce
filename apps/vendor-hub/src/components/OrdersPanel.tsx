'use client';

import { useEffect, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime, formatInr, ORDER_STATUS_LABEL } from '@spaceborn/web-core/format';
import type { Order, OrderStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  placed: { to: 'accepted', label: 'Accept order' },
  accepted: { to: 'packing', label: 'Start packing' },
  packing: { to: 'ready_for_pickup', label: 'Ready for delivery' },
  ready_for_pickup: { to: 'out_for_delivery', label: 'Dispatch for delivery' },
  out_for_delivery: { to: 'delivered', label: 'Confirm customer OTP' },
};

function printPackingSlip(order: Order) {
  const win = window.open('', '_blank', 'width=450,height=600');
  if (!win) return;
  const addr = order.deliveryAddress;
  const itemsHtml = order.items
    .map(
      (it) => `
      <tr>
        <td style="padding: 5px 0; border-bottom: 1px dashed #ddd;">
          <input type="checkbox" style="margin-right: 6px;" />
          <b>${it.quantity}x</b> ${it.name}
          <div style="font-size: 11px; color: #666; margin-left: 22px;">SKU: ${it.sku} · ₹${it.unitPrice}</div>
        </td>
        <td style="padding: 5px 0; border-bottom: 1px dashed #ddd; text-align: right; vertical-align: top;">
          ₹${it.lineTotal}
        </td>
      </tr>`,
    )
    .join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Packing Slip #${order.orderNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, monospace, sans-serif; font-size: 12px; margin: 12px; color: #111; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .title { font-size: 16px; font-weight: bold; }
          .section { margin: 8px 0; border-bottom: 1px dashed #aaa; padding-bottom: 6px; }
          .otp-box { border: 2px solid #000; padding: 8px; text-align: center; margin: 12px 0; font-weight: bold; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SPACEBORN DISPATCH SLIP</div>
          <div>Order #${order.orderNumber}</div>
          <div>${new Date(order.placedAt || order.createdAt).toLocaleString('en-IN')}</div>
        </div>

        <div class="section">
          <div><b>CUSTOMER:</b> ${addr.fullName}</div>
          <div><b>PHONE:</b> ${addr.phone}</div>
          <div><b>ADDRESS:</b> ${addr.line1}${addr.line2 ? `, ${addr.line2}` : ''}</div>
          ${addr.landmark ? `<div><b>LANDMARK:</b> ${addr.landmark}</div>` : ''}
          <div><b>CITY/PIN:</b> ${addr.city} - ${addr.pincode}</div>
        </div>

        <div class="section">
          <b>ITEMS CHECKLIST (${order.items.length} items):</b>
          <table>${itemsHtml}</table>
          <div style="text-align: right; font-weight: bold; margin-top: 8px; font-size: 13px;">Items Total: ₹${order.itemsTotal}</div>
        </div>

        <div class="otp-box">
          COLLECT 4-DIGIT DELIVERY CODE FROM CUSTOMER UPON HANDOVER
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

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
          confirmLabel: 'Confirm customer code',
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
        const addr = order.deliveryAddress;
        return (
          <article key={order.id} className={`rounded-xl border bg-white p-4 ${order.status === 'placed' ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-bold">
                  #{order.orderNumber}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[order.status] ?? 'bg-slate-100 text-slate-700'}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(order.placedAt ?? order.createdAt)} · {order.distanceKm.toFixed(1)} km away
                </p>
              </div>
              <p className="font-bold">{formatInr(order.itemsTotal)}</p>
            </div>

            {/* Customer Contact & Delivery Address Card */}
            <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">Customer: </span>
                  <span className="font-semibold text-slate-800">{addr.fullName}</span>
                  {addr.phone && (
                    <span className="ml-2">
                      <a href={`tel:${addr.phone}`} className="font-semibold text-indigo-600 underline">
                        📞 {addr.phone}
                      </a>
                      <a
                        href={`https://wa.me/91${addr.phone.replace(/\D/g, '').slice(-10)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 font-semibold text-emerald-600 underline"
                      >
                        💬 WhatsApp
                      </a>
                    </span>
                  )}
                </div>
                <div className="text-slate-500">
                  📍 {addr.city} ({addr.pincode})
                </div>
              </div>
              <p className="mt-1 text-slate-600">
                Deliver to: {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ''}
                {addr.landmark ? ` (Near: ${addr.landmark})` : ''}, {addr.city} - {addr.pincode}
              </p>
            </div>

            <ul className="mt-3 text-sm text-slate-700 divide-y divide-slate-100 border-t border-b border-slate-100 py-1">
              {order.items.map((item) => (
                <li key={item.productId} className="py-1 flex justify-between">
                  <span>
                    <b>{item.quantity}×</b> {item.name} <span className="text-xs text-slate-400">({item.sku})</span>
                  </span>
                  <span className="font-semibold">{formatInr(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {order.cancelReason && <p className="mt-2 text-xs text-red-600">Cancelled: {order.cancelReason}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {next && (
                <button
                  disabled={busy}
                  onClick={() => void transition(order, next.to)}
                  className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {busy ? 'Working…' : next.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => printPackingSlip(order)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                title="Print thermal dispatch packing slip"
              >
                <span>🖨️</span>
                <span>Print slip</span>
              </button>
              {VENDOR_CAN_CANCEL.includes(order.status) && (
                <button
                  disabled={busy}
                  onClick={() => void transition(order, 'cancelled')}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
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
