import type { FabStatus, OrderStatus, ServiceKind } from './types';

export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = { '3d_printing': '3D Printing', cnc: 'CNC Machining' };

export const FAB_STATUS_LABEL: Record<FabStatus, string> = {
  submitted: 'Waiting for quote',
  quoted: 'Quote ready',
  pending_payment: 'Awaiting payment',
  in_production: 'In production',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  declined: 'Declined by vendor',
  cancelled: 'Cancelled',
  expired: 'Quote expired',
};

export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const formatInr = (amount: number) => inr.format(amount);

export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  placed: 'Order placed',
  accepted: 'Accepted by store',
  packing: 'Packing',
  ready_for_pickup: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Payment timed out',
};
