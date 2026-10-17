'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@spaceborn/web-core/api';
import { useAuth } from '@spaceborn/web-core/auth';
import { formatDateTime, formatInr, ORDER_STATUS_LABEL } from '@spaceborn/web-core/format';
import type { CheckoutPayment, Order, OrderStatus, OrderItem } from '@spaceborn/web-core/types';
import { payWithRazorpay } from '../../lib/razorpay';
import { useDraft } from '@spaceborn/web-core/use-draft';
import { useLoad } from '@spaceborn/web-core/use-load';
import { useStore } from '../../context/StoreContext';
import { LiveDelivery } from '../../components/LiveDelivery';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Star,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  MapPin,
  Receipt,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Printer,
  ShoppingBag,
  RotateCcw,
  MessageSquarePlus,
  BadgeCheck,
  Sparkles,
} from 'lucide-react';

const PROGRESS_STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: 'placed', label: 'Placed', icon: Clock },
  { status: 'accepted', label: 'Confirmed', icon: CheckCircle2 },
  { status: 'packing', label: 'Packed & QC', icon: Package },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: BadgeCheck },
];

const ACTIVE_STATUSES: OrderStatus[] = ['pending_payment', 'placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'];

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

function getStatusTheme(status: OrderStatus) {
  if (status === 'delivered') {
    return {
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      icon: CheckCircle2,
      label: 'Delivered',
      dot: 'bg-emerald-500',
    };
  }
  if (status === 'pending_payment') {
    return {
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200/80',
      icon: Clock,
      label: 'Awaiting payment',
      dot: 'bg-amber-500',
    };
  }
  if (status === 'cancelled' || status === 'expired') {
    return {
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200/80',
      icon: AlertCircle,
      label: status === 'expired' ? 'Expired' : 'Cancelled',
      dot: 'bg-rose-500',
    };
  }
  return {
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200/80',
    icon: Truck,
    label: ORDER_STATUS_LABEL[status] || status,
    dot: 'bg-blue-500 animate-pulse',
  };
}

// Inline Item Review Form
function ItemReviewForm({
  item,
  orderNumber,
  onDone,
}: {
  item: OrderItem;
  orderNumber: number;
  onDone: (rating: number, title: string, comment: string) => void;
}) {
  const draftKey = `review:order:${orderNumber}:${item.productId}`;
  const [rating, setRating, clearRating] = useDraft(`${draftKey}:rating`, 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle, clearTitle] = useDraft(`${draftKey}:title`, '');
  const [comment, setComment, clearComment] = useDraft(`${draftKey}:comment`, '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !title.trim()) {
      setError('Please provide both a headline and review comments.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api(`/catalog/products/${encodeURIComponent(item.productId)}/reviews`, {
        method: 'POST',
        body: {
          rating,
          title: title.trim(),
          content: comment.trim(),
        },
      });
      onDone(rating, title.trim(), comment.trim());
      clearRating();
      clearTitle();
      clearComment();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-sb-card rounded-xl border border-sb-brand/30 space-y-3 animate-in fade-in duration-200 text-xs"
    >
      <div className="flex items-center justify-between pb-2 border-b border-sb-line/40">
        <div>
          <span className="font-bold text-sb-ink">Rate & Review {item.name}</span>
          <p className="text-[11px] text-sb-muted">Verified Purchase in Order #{orderNumber}</p>
        </div>
        <span className="text-[10px] font-bold bg-sb-brand-soft text-sb-brand border border-sb-brand/20 px-2 py-0.5 rounded-full">
          ✓ Verified Order
        </span>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Star Rating Picker */}
      <div>
        <label className="font-bold text-sb-ink block mb-1">Rating (1 to 5 Stars):</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 cursor-pointer transition-transform hover:scale-115"
            >
              <Star
                className={`w-5 h-5 ${
                  star <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                }`}
              />
            </button>
          ))}
          <span className="ml-2 text-xs font-semibold text-sb-muted">
            {hoverRating || rating} / 5 Stars
          </span>
        </div>
      </div>

      <div>
        <label className="font-bold text-sb-ink block mb-1">Review Headline:</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Accurate specs, worked flawlessly in my robot chassis"
          className="w-full h-8 rounded-lg border border-sb-line/70 px-2.5 text-xs outline-none focus:border-sb-brand bg-white"
        />
      </div>

      <div>
        <label className="font-bold text-sb-ink block mb-1">Bench Test Comments & Findings:</label>
        <textarea
          required
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Describe how the component performed under real voltage/load, build quality, and pinout compatibility..."
          className="w-full rounded-lg border border-sb-line/70 p-2.5 text-xs outline-none focus:border-sb-brand bg-white"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => onDone(0, '', '')}
          className="px-3 py-1.5 font-semibold text-sb-muted hover:text-sb-ink cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-1.5 font-bold text-white bg-sb-brand hover:bg-sb-brand-strong rounded-lg transition cursor-pointer shadow-xs disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Publish Verified Review'}
        </button>
      </div>
    </form>
  );
}

function OrderCard({
  order,
  onCancelled,
}: {
  order: Order;
  onCancelled: () => void;
}) {
  const router = useRouter();
  const { products, addToCart } = useStore();
  const [cancelling, setCancelling] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [reviewingItemId, setReviewingItemId] = useDraft<string | null>(`orders:reviewing:${order.id}`, null);
  const [reviewedItems, setReviewedItems] = useState<Record<string, { rating: number; title: string }>>({});
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [reordered, setReordered] = useState(false);
  const [paying, setPaying] = useState(false);

  const refunding =
    order.paymentStatus === 'captured' || order.paymentStatus === 'refund_pending' || order.paymentStatus === 'refunded';

  const resumePay = async () => {
    setPaying(true);
    try {
      const placed = await api<{ order: Order; payment: CheckoutPayment }>(`/orders/${order.id}/pay`, { method: 'POST', body: {} });
      if (placed.payment.provider === 'razorpay') {
        const result = await payWithRazorpay(placed.payment, `Order #${order.orderNumber}`, {
          name: order.deliveryAddress.fullName,
          contact: order.deliveryAddress.phone,
        });
        await api('/payments/razorpay/verify', { method: 'POST', body: { orderId: order.id, ...result } });
      } else {
        await api('/payments/mock/confirm', { method: 'POST', body: { orderId: order.id } });
      }
      onCancelled();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPaying(false);
    }
  };

  const theme = getStatusTheme(order.status);
  const isTerminal = ['delivered', 'cancelled', 'expired'].includes(order.status);
  const isActive = ACTIVE_STATUSES.includes(order.status);

  // Stepper Calculation
  const currentStepIndex = (() => {
    switch (order.status) {
      case 'placed':
        return 0;
      case 'accepted':
        return 1;
      case 'packing':
        return 2;
      case 'ready_for_pickup':
        return 2;
      case 'out_for_delivery':
        return 3;
      case 'delivered':
        return 4;
      default:
        return -1;
    }
  })();

  const handleCopyOtp = async () => {
    if (!order.handoverOtp) return;
    try {
      await navigator.clipboard.writeText(order.handoverOtp);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(String(order.orderNumber));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const cancel = async () => {
    const message =
      order.status === 'pending_payment' && order.checkoutId
        ? 'Cancel this checkout? Nothing has been charged. If it was split into more than one delivery, they are all cancelled together.'
        : 'Cancel this order? Paid amounts are refunded to your original payment method within 3-5 business days.';
    if (!confirm(message)) return;
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

  const handleReorder = () => {
    for (const item of order.items) {
      const match = products.find((p) => p.id === item.productId || p.sku === item.sku);
      if (match) {
        addToCart(match, item.quantity);
      }
    }
    setReordered(true);
    setTimeout(() => {
      setReordered(false);
      router.push('/cart');
    }, 1200);
  };

  return (
    <article className="rounded-2xl border border-sb-line/60 bg-white shadow-xs hover:shadow-sm transition-all overflow-hidden">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-sb-line/40 bg-sb-card/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sb-canvas border border-sb-line/60 flex items-center justify-center text-sb-ink">
            <Package className="w-5 h-5 text-sb-ink" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sb-ink text-sm sm:text-base tracking-tight">
                Order #{order.orderNumber}
              </span>
              <button
                onClick={handleCopyOrderId}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sb-muted hover:text-sb-ink bg-white border border-sb-line/50 px-2 py-0.5 rounded-md cursor-pointer transition"
                title="Copy Order Number"
              >
                {copiedId ? <Check className="w-3 h-3 text-sb-brand" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-xs text-sb-muted flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-sb-muted/70" />
              <span>{formatDateTime(order.placedAt ?? order.createdAt)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${theme.badgeBg}`}
          >
            <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
            <theme.icon className="w-3.5 h-3.5" />
            <span>{ORDER_STATUS_LABEL[order.status] || theme.label}</span>
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Visual Progress Stepper for In-Transit & Delivered Orders */}
        {order.status !== 'cancelled' && order.status !== 'expired' && order.status !== 'pending_payment' ? (
          <div className="p-3.5 sm:p-4 rounded-xl bg-sb-card border border-sb-line/40 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-sb-muted">
              <span className="flex items-center gap-1.5 text-sb-ink font-bold">
                <Truck className="w-3.5 h-3.5 text-sb-brand" />
                <span>Delivery Tracking</span>
              </span>
              {order.status === 'delivered' ? (
                <span className="text-sb-brand font-bold">Delivered</span>
              ) : order.status === 'out_for_delivery' ? (
                <span className="text-sb-brand font-bold">
                  Out for delivery{order.etaMinutes ? ` · about ${order.etaMinutes} min` : ''}
                </span>
              ) : (
                <span className="text-sb-brand font-bold">{ORDER_STATUS_LABEL[order.status]}</span>
              )}
            </div>

            {/* Stepper Pipeline */}
            <div className="relative pt-1 pb-1">
              <div className="grid grid-cols-5 gap-1 text-center">
                {PROGRESS_STEPS.map((step, idx) => {
                  const isPassed = currentStepIndex >= idx;
                  const isCurrent = currentStepIndex === idx;
                  const StepIcon = step.icon;

                  return (
                    <div key={step.status} className="flex flex-col items-center group">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isPassed
                            ? 'bg-sb-brand text-white shadow-xs'
                            : 'bg-white border border-sb-line/70 text-sb-muted'
                        } ${isCurrent ? 'ring-2 ring-sb-brand/40 ring-offset-1' : ''}`}
                      >
                        <StepIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold leading-tight ${
                          isPassed ? 'text-sb-ink' : 'text-sb-muted'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 h-1.5 w-full bg-sb-line/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sb-brand transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.max(10, ((currentStepIndex + 1) / PROGRESS_STEPS.length) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Live map: the store's own rider, from their counter to your door */}
            {isActive && (
              <div className="pt-2 border-t border-sb-line/40">
                <LiveDelivery orderId={order.id} status={order.status} onStatusChange={onCancelled} />
              </div>
            )}
          </div>
        ) : order.status === 'pending_payment' ? (
          <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
            <span>Payment was not finished. The items stay reserved for a short time.</span>
            <button
              type="button"
              onClick={() => void resumePay()}
              disabled={paying}
              className="rounded-lg bg-sb-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {paying ? 'Opening payment…' : 'Pay now'}
            </button>
          </div>
        ) : (
          <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50/70 border border-rose-200/60 text-xs text-rose-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {refunding
                  ? order.paymentStatus === 'refunded'
                    ? 'This order is cancelled. The refund has been sent to your payment method.'
                    : 'This order is cancelled. A refund is on its way to your payment method.'
                  : 'This order is cancelled. No payment was charged.'}
              </span>
            </div>
            <button
              onClick={handleReorder}
              className="text-xs font-bold text-sb-brand hover:underline cursor-pointer shrink-0"
            >
              Reorder items →
            </button>
          </div>
        )}

        {/* Handover OTP Box for In-Transit Orders */}
        {order.handoverOtp && isActive && order.status !== 'pending_payment' && (
          <div className="rounded-xl bg-sb-ink text-sb-canvas p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Security Handover Code</span>
              </div>
              <p className="text-xs text-sb-canvas/80">
                Read this 4-digit code to the store's rider when they arrive. They cannot complete the delivery without it.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-2xl font-black tracking-widest bg-white/10 px-4 py-1.5 rounded-xl border border-white/20 text-white shadow-xs">
                {order.handoverOtp}
              </span>
              <button
                onClick={handleCopyOtp}
                className="h-9 px-3 rounded-xl bg-sb-brand hover:bg-sb-brand-strong text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              >
                {copiedOtp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedOtp ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Delivery Destination Address */}
        <div className="flex items-start gap-2.5 text-xs text-sb-muted bg-sb-card/50 p-3 rounded-xl border border-sb-line/40">
          <MapPin className="w-4 h-4 text-[#e2434b] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sb-ink">Delivery Destination: </span>
            <span>
              {order.deliveryAddress.line1}, {order.deliveryAddress.city} – {order.deliveryAddress.pincode}
            </span>
          </div>
        </div>

        {/* Ordered Components List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sb-muted border-b border-sb-line/40 pb-1.5">
            Ordered Hardware & Components ({order.items.length})
          </h4>
          <div className="divide-y divide-sb-line/30">
            {order.items.map((item) => {
              const isDelivered = order.status === 'delivered';
              const reviewed = reviewedItems[item.productId];
              const isReviewing = reviewingItemId === item.productId;

              return (
                <div key={item.productId} className="py-3 first:pt-1 last:pb-1 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-sb-card border border-sb-line/60 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="w-5 h-5 text-sb-muted" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/product/${encodeURIComponent(item.productId)}`}
                          className="text-xs sm:text-sm font-bold text-sb-ink hover:text-sb-brand hover:underline transition truncate block"
                          title={item.name}
                        >
                          {item.name}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-sb-muted mt-0.5">
                          <span className="font-mono">SKU: {item.sku}</span>
                          <span>·</span>
                          <span>Qty: <b>{item.quantity}</b></span>
                          <span>·</span>
                          <span>{formatInr(item.unitPrice)} ea</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                      <span className="font-extrabold text-sm text-sb-ink">
                        {formatInr(item.lineTotal)}
                      </span>

                      {/* Direct Verified Rate & Review Button - only on delivered orders */}
                      {isDelivered && (
                        <div>
                          {reviewed ? (
                            <button
                              onClick={() => setReviewingItemId(isReviewing ? null : item.productId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-sb-brand border border-sb-brand/30 px-2.5 py-1 text-[11px] font-bold transition cursor-pointer"
                            >
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>Rated ({reviewed.rating}★) · Edit</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setReviewingItemId(isReviewing ? null : item.productId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-sb-canvas hover:bg-sb-brand text-sb-ink hover:text-white px-2.5 py-1 text-[11px] font-bold transition cursor-pointer shadow-2xs"
                              title="Rate and review this purchased component"
                            >
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{isReviewing ? 'Close Form' : '★ Rate Item'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline Review Form Drawer */}
                  {isReviewing && (
                    <ItemReviewForm
                      item={item}
                      orderNumber={order.orderNumber}
                      onDone={(rating, title, comment) => {
                        if (rating > 0) {
                          setReviewedItems((prev) => ({
                            ...prev,
                            [item.productId]: { rating, title },
                          }));
                        }
                        setReviewingItemId(null);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial & Fee Breakdown */}
        <div className="pt-3 border-t border-sb-line/40 space-y-1.5 text-xs text-sb-muted">
          <div className="flex justify-between">
            <span>Components Subtotal</span>
            <span>{formatInr(order.itemsTotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Store delivery</span>
            <span>
              {order.deliveryFee === 0 ? (
                <span className="font-bold text-sb-brand bg-sb-brand-soft px-1.5 py-0.5 rounded border border-sb-brand/20">
                  FREE
                </span>
              ) : (
                formatInr(order.deliveryFee)
              )}
            </span>
          </div>
          {order.platformFee > 0 && (
            <div className="flex justify-between">
              <span>Platform & Packaging Fee</span>
              <span>{formatInr(order.platformFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm sm:text-base font-extrabold text-sb-ink pt-1 border-t border-sb-line/40">
            <span>Grand Total</span>
            <span>{formatInr(order.grandTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-sb-muted">
              Payment Status:{' '}
              <b className="text-sb-ink uppercase">
                {order.status === 'pending_payment'
                  ? 'Awaiting payment'
                  : order.paymentStatus === 'refunded'
                    ? 'Refunded'
                    : order.paymentStatus === 'refund_pending'
                      ? 'Refund in progress'
                      : order.paymentStatus === 'captured'
                        ? 'Paid'
                        : order.status === 'cancelled' || order.status === 'expired'
                          ? 'Not charged'
                          : order.paymentStatus?.replace('_', ' ') || 'Paid'}
              </b>
            </span>
            {order.status === 'delivered' && (
              <span className="text-sb-brand font-semibold">Receipt</span>
            )}
          </div>
          {order.cancelReason && !order.cancelReason.toLowerCase().includes('payment') && !order.cancelReason.toLowerCase().includes('time') && (
            <p className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              Cancellation Reason: {order.cancelReason}
            </p>
          )}
        </div>

        {/* Action Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-sb-line/40">
          <div className="flex items-center gap-2">
            {/* View Receipt - strictly only for delivered orders, NEVER for cancelled orders */}
            {order.status === 'delivered' && (
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sb-line/70 bg-white hover:bg-sb-canvas/40 text-xs font-semibold text-sb-ink cursor-pointer transition shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-sb-muted" />
                <span>View Receipt</span>
              </button>
            )}

            {isTerminal && (
              <button
                onClick={handleReorder}
                disabled={reordered}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sb-canvas hover:bg-sb-brand text-sb-ink hover:text-white text-xs font-bold cursor-pointer transition shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{reordered ? 'Added to Cart!' : 'Buy Again'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/contact?order=${order.orderNumber}`}
              className="text-xs font-semibold text-sb-muted hover:text-sb-ink hover:underline"
            >
              Need Support?
            </Link>

            {(order.status === 'pending_payment' || order.status === 'placed') && (
              <button
                onClick={cancel}
                disabled={cancelling}
                className="rounded-xl border border-[#e2434b]/40 px-3 py-1.5 text-xs font-bold text-[#e2434b] hover:bg-rose-50 disabled:opacity-50 cursor-pointer transition"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Order'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-sb-line/60 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-sb-line/40">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-sb-brand" />
                <h3 className="font-extrabold text-sb-ink text-base">Spaceborn Tax Receipt</h3>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2 text-sb-muted">
              <div className="flex justify-between">
                <span>Receipt Number:</span>
                <span className="font-mono font-bold text-sb-ink">REC-{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{formatDateTime(order.placedAt ?? order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Address:</span>
                <span className="text-right text-sb-ink font-medium max-w-[200px]">
                  {order.deliveryAddress.line1}, {order.deliveryAddress.city} ({order.deliveryAddress.pincode})
                </span>
              </div>
            </div>

            <div className="border-t border-b border-sb-line/40 py-2 space-y-2">
              <span className="text-[11px] font-bold text-sb-muted uppercase block">Item Details</span>
              {order.items.map((it) => (
                <div key={it.productId} className="flex justify-between text-xs">
                  <span className="truncate pr-2">
                    {it.quantity} × {it.name}
                  </span>
                  <span className="font-semibold text-sb-ink">{formatInr(it.lineTotal)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs text-sb-muted">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatInr(order.itemsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span>{order.deliveryFee === 0 ? 'FREE' : formatInr(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-sb-ink pt-1 border-t border-sb-line/30">
                <span>Total Paid:</span>
                <span>{formatInr(order.grandTotal)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sb-brand hover:bg-sb-brand-strong text-white text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeFilter, setActiveFilter] = useDraft<'all' | 'active' | 'delivered' | 'cancelled'>('orders:filter', 'all');
  const [searchQuery, setSearchQuery] = useDraft('orders:search', '');

  const orders = useLoad(
    () => (user ? api<{ orders: Order[] }>('/orders').then((r) => r.orders) : Promise.resolve([] as Order[])),
    [user?.uid],
  );

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/orders');
  }, [loading, user, router]);

  const hasActive = orders.data?.some((o) => ACTIVE_STATUSES.includes(o.status));
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void orders.reload(), 20_000);
    return () => clearInterval(timer);
  }, [hasActive, orders.reload]);

  // Filter & Search Logic
  const filteredOrders = useMemo(() => {
    if (!orders.data) return [];
    let list = orders.data;

    if (activeFilter === 'active') {
      list = list.filter((o) => ACTIVE_STATUSES.includes(o.status));
    } else if (activeFilter === 'delivered') {
      list = list.filter((o) => o.status === 'delivered');
    } else if (activeFilter === 'cancelled') {
      list = list.filter((o) => ['cancelled', 'expired'].includes(o.status));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          String(o.orderNumber).includes(q) ||
          o.deliveryAddress?.city?.toLowerCase().includes(q) ||
          o.items?.some((it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [orders.data, activeFilter, searchQuery]);

  // Counts for Badges
  const counts = useMemo(() => {
    const all = orders.data?.length || 0;
    const active = orders.data?.filter((o) => ACTIVE_STATUSES.includes(o.status)).length || 0;
    const delivered = orders.data?.filter((o) => o.status === 'delivered').length || 0;
    const cancelled = orders.data?.filter((o) => ['cancelled', 'expired'].includes(o.status)).length || 0;
    return { all, active, delivered, cancelled };
  }, [orders.data]);

  if (loading || !user) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-xs text-sb-muted space-y-2">
        <RefreshCw className="w-5 h-5 animate-spin text-sb-brand" />
        <span>Authenticating your Spaceborn account…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:py-8">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-sb-muted">
        <div className="flex items-center space-x-2">
          <button onClick={() => router.push('/')} className="hover:text-sb-ink cursor-pointer transition-colors">
            Home
          </button>
          <span>/</span>
          <button onClick={() => router.push('/profile')} className="hover:text-sb-ink cursor-pointer transition-colors">
            Dashboard
          </button>
          <span>/</span>
          <span className="font-semibold text-sb-ink">My Orders</span>
        </div>
        <button
          onClick={() => router.push('/profile')}
          className="text-xs font-bold text-sb-brand hover:underline cursor-pointer flex items-center gap-1"
        >
          <span>← Back to Dashboard</span>
        </button>
      </div>

      {/* Main Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-sb-line/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-sb-ink tracking-tight">My Orders</h1>
            {hasActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sb-brand-soft text-sb-brand border border-sb-brand/20">
                <span className="w-1.5 h-1.5 rounded-full bg-sb-brand animate-ping" />
                Live Tracking Active
              </span>
            )}
          </div>
          <p className="text-xs text-sb-muted mt-1">
            Track your deliveries, view security handover OTPs, review purchased components, and download receipts.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Orders', count: counts.all },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'delivered', label: 'Delivered', count: counts.delivered },
            { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
          ].map((tab) => {
            const isSelected = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-sb-ink text-sb-canvas shadow-xs'
                    : 'bg-sb-card border border-sb-line/60 text-sb-muted hover:text-sb-ink'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-sb-canvas' : 'bg-sb-canvas text-sb-ink'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-sb-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, part, SKU…"
            className="w-full h-8.5 rounded-xl border border-sb-line/60 bg-sb-card pl-8.5 pr-7 text-xs outline-none focus:border-sb-brand text-sb-ink"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {orders.error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{orders.error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {orders.loading && !orders.data && (
        <div className="p-12 text-center text-xs text-sb-muted space-y-2 bg-sb-card rounded-3xl border border-sb-line/60">
          <RefreshCw className="w-6 h-6 animate-spin text-sb-brand mx-auto" />
          <p className="font-bold text-sb-ink">Synchronizing your order log…</p>
          <p className="text-[11px]">Connecting to nearest regional micro-fulfillment center.</p>
        </div>
      )}

      {/* Empty State: No Orders At All */}
      {orders.data && orders.data.length === 0 && (
        <div className="rounded-3xl border border-sb-line/60 bg-sb-card p-10 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-sb-canvas border border-sb-line/60 flex items-center justify-center text-sb-ink mx-auto">
            <ShoppingBag className="w-8 h-8 text-sb-brand" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-sb-ink">You haven't placed any hardware orders yet</h3>
            <p className="text-xs text-sb-muted max-w-md mx-auto">
              Microcontrollers, sensors, gear motors and lab essentials, sent by the nearest shop that has them.
            </p>
          </div>
          <button
            onClick={() => router.push('/catalog')}
            className="rounded-xl bg-sb-brand px-6 py-2.5 text-xs font-bold text-white hover:bg-sb-brand-strong transition cursor-pointer shadow-xs inline-flex items-center gap-2"
          >
            <span>Explore Electronics Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty State: Search / Filter Returned 0 */}
      {orders.data && orders.data.length > 0 && filteredOrders.length === 0 && (
        <div className="rounded-2xl border border-sb-line/60 bg-sb-card p-8 text-center space-y-3">
          <Package className="w-8 h-8 text-sb-muted mx-auto opacity-50" />
          <p className="text-xs font-bold text-sb-ink">
            No orders found matching "{searchQuery || activeFilter}".
          </p>
          <button
            onClick={() => {
              setActiveFilter('all');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-sb-brand hover:underline cursor-pointer"
          >
            Reset filters to view all orders
          </button>
        </div>
      )}

      {/* Render Filtered Orders */}
      {groupOrders(filteredOrders).map((group) => (
        <section key={group.key} className="space-y-3">
          {group.orders.length > 1 && (
            <div className="flex items-center justify-between px-2 py-1 text-xs text-sb-muted bg-sb-canvas/40 rounded-xl border border-sb-line/40">
              <span className="font-semibold text-sb-ink">
                Consolidated Checkout · {group.orders.length} deliveries · Platform fee charged once
              </span>
              <span className="font-bold text-sb-ink">
                {formatInr(group.orders.reduce((sum, o) => sum + o.grandTotal, 0))}
              </span>
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
