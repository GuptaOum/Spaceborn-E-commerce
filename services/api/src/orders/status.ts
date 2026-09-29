import type { Role } from '../auth.js';

export const ORDER_STATUSES = [
  'pending_payment',
  'placed',
  'accepted',
  'packing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'expired',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type Actor = Role | 'system';

const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Actor[]>>> = {
  pending_payment: { placed: ['system'], expired: ['system'], cancelled: ['customer', 'admin', 'system'] },
  placed: { accepted: ['vendor'], cancelled: ['customer', 'vendor', 'admin'] },
  accepted: { packing: ['vendor'], cancelled: ['vendor', 'admin'] },
  packing: { ready_for_pickup: ['vendor'], cancelled: ['vendor', 'admin'] },
  ready_for_pickup: { out_for_delivery: ['vendor'], cancelled: ['admin'] },
  out_for_delivery: { delivered: ['vendor'], cancelled: ['admin'] },
  delivered: {},
  cancelled: {},
  expired: {},
};

export const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'expired'];

// Stock is held from checkout until the order ends without being delivered.
export const HOLDS_STOCK: OrderStatus[] = ['pending_payment', 'placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'];

// Money has been taken for these; cancelling them must trigger a refund.
export const PAID_STATUSES: OrderStatus[] = ['placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'];

export function canTransition(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

export function nextStatusesFor(from: OrderStatus, actor: Actor): OrderStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [OrderStatus, Actor[]][])
    .filter(([, actors]) => actors.includes(actor))
    .map(([to]) => to);
}
