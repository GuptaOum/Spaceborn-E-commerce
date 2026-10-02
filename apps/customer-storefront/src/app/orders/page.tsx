'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@spaceborn/web-core/api';
import { useAuth } from '@spaceborn/web-core/auth';
import { formatDateTime, formatInr, ORDER_STATUS_LABEL } from '@spaceborn/web-core/format';
import type { Order, OrderStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const PROGRESS: OrderStatus[] = ['placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];
const ACTIVE: OrderStatus[] = ['pending_payment', ...PROGRESS.slice(0, -1)];

function groupOrders(orders: Order[]) {
  const groups: { key: string; orders: Order[] }[] = [];
  const index = new Map<string, number>();
  for (const order of orders) {
    const key = order.checkoutId ?? order.id;
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, groups.length);
      groups.push({ key, orders: [order] });
    } else {
      groups[at]!.orders.push(order);
    }
  }
  return groups;
}

function OrderCard({ order, onCancelled }: { order: Order; onCancelled: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  const step = PROGRESS.indexOf(order.status);

  const cancel = async () => {
    if (!confirm('Cancel this order? Paid amounts are refunded to the original payment method.')) return;
    setCancelling(true);
    try {
      await api(`/orders/${order.id}/cancel`, { method: 'POST', body: {} });
      onCancelled();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <article className="rounded-3xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[#34222e]">Order #{order.orderNumber}</p>
          <p className="text-xs text-[#7a6274]">{formatDateTime(order.placedAt ?? order.createdAt)}</p>
        </div>
        <span className="rounded-full bg-[#f2fcf4] px-3 py-1 text-xs font-bold text-[#0c831f]">
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      {step >= 0 && (
        <div className="mt-4 flex gap-1">
          {PROGRESS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-[#0c831f]' : 'bg-[#f9bf8f]/40'}`} />
          ))}
        </div>
      )}

      {order.handoverOtp && ACTIVE.includes(order.status) && order.status !== 'pending_payment' && (
        <p className="mt-4 rounded-xl bg-[#34222e] px-4 py-3 text-sm text-[#fee9d7]">
          Delivery code: <b className="font-mono text-lg tracking-widest">{order.handoverOtp}</b>
          <span className="ml-2 text-xs opacity-80">Share it only when your order is in your hands.</span>
        </p>
      )}

      <ul className="mt-4 space-y-2 text-sm text-[#34222e]">
        {order.items.map((item) => (
          <li key={item.productId} className="flex items-center justify-between gap-2">
            <span className="truncate flex-1">
              {item.quantity} × {item.name}
            </span>
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="font-semibold">{formatInr(item.lineTotal)}</span>
              <Link
                href={`/product/${encodeURIComponent(item.productId)}`}
                className="rounded-lg bg-[#fee9d7] hover:bg-[#0c831f] hover:text-white px-2 py-0.5 text-[11px] font-bold text-[#34222e] transition"
                title="Review this component"
              >
                ★ Review
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1 border-t border-[#f9bf8f]/40 pt-3 text-xs text-[#7a6274]">
        <div className="flex justify-between">
          <span>Delivery fee</span>
          <span>{order.deliveryFee === 0 ? 'FREE' : formatInr(order.deliveryFee)}</span>
        </div>
        {order.platformFee > 0 && (
          <div className="flex justify-between">
            <span>Platform fee</span>
            <span>{formatInr(order.platformFee)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-[#34222e]">
          <span>Total</span>
          <span>{formatInr(order.grandTotal)}</span>
        </div>
        {order.paymentStatus && <p>Payment: {order.paymentStatus.replace('_', ' ')}</p>}
        {order.cancelReason && <p className="text-[#e2434b]">Cancelled: {order.cancelReason}</p>}
      </div>

      {(order.status === 'pending_payment' || order.status === 'placed') && (
        <button
          onClick={cancel}
          disabled={cancelling}
          className="mt-4 rounded-xl border border-[#e2434b]/40 px-4 py-2 text-xs font-bold text-[#e2434b] disabled:opacity-50"
        >
          {cancelling ? 'Cancelling…' : 'Cancel order'}
        </button>
      )}
    </article>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const orders = useLoad(
    () => (user ? api<{ orders: Order[] }>('/orders').then((r) => r.orders) : Promise.resolve([] as Order[])),
    [user?.uid],
  );

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/orders');
  }, [loading, user, router]);

  const hasActive = orders.data?.some((o) => ACTIVE.includes(o.status));
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void orders.reload(), 20_000);
    return () => clearInterval(timer);
  }, [hasActive, orders.reload]);

  if (loading || !user) {
    return <div className="min-h-[50vh] flex items-center justify-center text-xs text-[#7a6274]">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:py-8">
      {/* Breadcrumbs & Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-[#7a6274]">
        <div className="flex items-center space-x-2">
          <button onClick={() => router.push('/')} className="hover:text-[#34222e] cursor-pointer transition-colors">Home</button>
          <span>/</span>
          <button onClick={() => router.push('/profile')} className="hover:text-[#34222e] cursor-pointer transition-colors">Dashboard</button>
          <span>/</span>
          <span className="font-semibold text-[#34222e]">My Orders</span>
        </div>
        <button
          onClick={() => router.push('/profile')}
          className="text-xs font-bold text-[#0c831f] hover:underline cursor-pointer"
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold text-[#34222e]">My orders</h1>
          <p className="text-xs text-[#7a6274] mt-0.5">Live tracking, handover OTP codes, and delivery progress.</p>
        </div>
        <button
          onClick={() => void orders.reload()}
          className="px-3 py-1.5 rounded-xl border border-[#f9bf8f]/60 bg-[#fffbf7] hover:bg-[#fee9d7]/50 text-xs font-semibold text-[#34222e] cursor-pointer transition shadow-xs"
        >
          Refresh
        </button>
      </div>

      {orders.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{orders.error}</p>}
      {orders.loading && !orders.data && <p className="text-sm text-[#7a6274]">Loading your orders…</p>}
      {orders.data?.length === 0 && (
        <div className="rounded-3xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-8 text-center">
          <p className="text-sm text-[#7a6274]">No orders yet.</p>
          <button onClick={() => router.push('/catalog')} className="mt-3 rounded-xl bg-[#0c831f] px-5 py-2 text-xs font-bold text-white cursor-pointer hover:bg-[#0a6e1a] transition">
            Start shopping
          </button>
        </div>
      )}
      {groupOrders(orders.data ?? []).map((group) => (
        <section key={group.key} className="space-y-3">
          {group.orders.length > 1 && (
            <div className="flex items-center justify-between px-1 text-xs text-[#7a6274]">
              <span className="font-semibold text-[#34222e]">One payment · {group.orders.length} deliveries · platform fee charged once</span>
              <span className="font-bold text-[#34222e]">{formatInr(group.orders.reduce((sum, order) => sum + order.grandTotal, 0))}</span>
            </div>
          )}
          {group.orders.map((order) => (
            <OrderCard key={order.id} order={order} onCancelled={orders.reload} />
          ))}
        </section>
      ))}
    </div>
  );
}
