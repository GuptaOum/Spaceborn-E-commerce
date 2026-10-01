'use client';

import { useMemo, useState } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const filteredOrders = useMemo(() => {
    const list = orders.data ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (o) =>
        String(o.orderNumber).includes(q) ||
        o.storeName.toLowerCase().includes(q) ||
        o.deliveryAddress.fullName.toLowerCase().includes(q) ||
        o.deliveryAddress.phone.includes(q) ||
        o.items?.some((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)),
    );
  }, [orders.data, searchQuery]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search order #, store, customer, phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => void orders.refresh()}
          disabled={orders.refreshing}
          className="ml-auto text-xs font-semibold text-slate-600 underline disabled:opacity-50"
        >
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
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <tr key={order.id} className="border-t border-slate-100 group">
                      <td colSpan={8} className="p-0">
                        <div className="flex items-center px-3 py-2.5 hover:bg-slate-50/60 transition-colors">
                          <div className="w-[12%] font-mono text-xs font-semibold text-slate-900">
                            #{order.orderNumber}
                          </div>
                          <div className="w-[18%] text-xs font-medium text-slate-800 truncate pr-2">
                            {order.storeName}
                          </div>
                          <div className="w-[20%] text-xs text-slate-600 pr-2">
                            <span className="font-medium text-slate-800">{order.deliveryAddress.fullName}</span>
                            <span className="block text-[11px] text-slate-400">{order.deliveryAddress.pincode} · {order.deliveryAddress.phone}</span>
                          </div>
                          <div className="w-[14%]">
                            <span className={`text-xs font-semibold ${TONE[order.status] ?? ''}`}>
                              {ORDER_STATUS_LABEL[order.status]}
                            </span>
                          </div>
                          <div className="w-[12%] text-xs capitalize text-slate-600">
                            {order.paymentStatus?.replace('_', ' ') ?? '—'}
                          </div>
                          <div className="w-[10%] text-right font-semibold text-slate-900 text-xs">
                            {formatInr(order.grandTotal)}
                          </div>
                          <div className="w-[14%] text-right flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : order.id)}
                              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              {isExpanded ? 'Hide' : `Items (${order.items?.length ?? 0})`}
                            </button>
                            {CANCELLABLE.includes(order.status) && (
                              <button
                                disabled={busyId === order.id}
                                onClick={() => void cancel(order)}
                                className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                              >
                                {busyId === order.id ? '…' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable itemized inspection drawer */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-slate-50/80 p-4 space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              {/* Customer & Delivery Card */}
                              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                <p className="font-semibold text-slate-800">Customer & Delivery</p>
                                <p className="mt-1 font-medium text-slate-900">{order.deliveryAddress.fullName}</p>
                                <p className="mt-0.5 text-slate-600">
                                  Phone:{' '}
                                  <a href={`tel:${order.deliveryAddress.phone}`} className="font-semibold text-sky-700 underline">
                                    {order.deliveryAddress.phone}
                                  </a>
                                  <a
                                    href={`https://wa.me/91${order.deliveryAddress.phone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 font-medium text-emerald-700 underline"
                                  >
                                    💬 WhatsApp
                                  </a>
                                </p>
                                <p className="mt-1 text-slate-600">
                                  {order.deliveryAddress.line1}
                                  {order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''}
                                  {order.deliveryAddress.landmark ? ` (Near ${order.deliveryAddress.landmark})` : ''}
                                </p>
                                <p className="text-slate-600">
                                  {order.deliveryAddress.city} - {order.deliveryAddress.pincode}
                                </p>
                                <p className="mt-1 text-slate-400">Placed: {formatDateTime(order.createdAt)}</p>
                                {order.cancelReason && (
                                  <p className="mt-2 rounded bg-red-50 p-2 text-red-700">
                                    Cancellation reason: {order.cancelReason}
                                  </p>
                                )}
                              </div>

                              {/* Financial Breakdown */}
                              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                <p className="font-semibold text-slate-800">Payment & Pricing Breakdown</p>
                                <div className="mt-2 space-y-1 text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Items subtotal</span>
                                    <span>{formatInr(order.itemsTotal)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Delivery fee</span>
                                    <span>{formatInr(order.deliveryFee)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Platform fee</span>
                                    <span>{formatInr(order.platformFee)}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
                                    <span>Grand total</span>
                                    <span>{formatInr(order.grandTotal)}</span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    Payment status: <span className="font-semibold uppercase text-slate-700">{order.paymentStatus ?? 'Pending'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Itemized Line Items */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold text-slate-800">Itemized Checklist ({order.items?.length ?? 0} SKUs)</p>
                              <div className="mt-2 divide-y divide-slate-100 text-xs">
                                {order.items?.map((item) => (
                                  <div key={item.productId} className="flex items-center justify-between py-2">
                                    <div>
                                      <p className="font-medium text-slate-900">{item.name}</p>
                                      <p className="text-[11px] text-slate-400 font-mono">SKU: {item.sku}</p>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-slate-600 font-medium">{item.quantity} × {formatInr(item.unitPrice)}</span>
                                      <span className="ml-4 font-semibold text-slate-900">{formatInr(item.lineTotal)}</span>
                                    </div>
                                  </div>
                                ))}
                                {(!order.items || order.items.length === 0) && (
                                  <p className="py-2 text-slate-400">No line items recorded for this order.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredOrders.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                {searchQuery ? `No orders matching “${searchQuery}”.` : `No ${filter === 'all' ? '' : filter} orders.`}
              </p>
            )}
          </div>
        )}
      </ListState>
    </div>
  );
}
