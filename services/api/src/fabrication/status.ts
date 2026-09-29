import type { Actor } from '../orders/status.js';

export const SERVICE_KINDS = ['3d_printing', 'cnc'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const FAB_STATUSES = [
  'submitted',
  'quoted',
  'pending_payment',
  'in_production',
  'ready',
  'out_for_delivery',
  'delivered',
  'declined',
  'cancelled',
  'expired',
] as const;
export type FabStatus = (typeof FAB_STATUSES)[number];

const TRANSITIONS: Record<FabStatus, Partial<Record<FabStatus, Actor[]>>> = {
  submitted: { quoted: ['vendor'], declined: ['vendor'], cancelled: ['customer', 'admin'] },
  quoted: { quoted: ['vendor'], pending_payment: ['customer'], declined: ['vendor'], cancelled: ['customer', 'admin'], expired: ['system'] },
  pending_payment: { in_production: ['system'], cancelled: ['customer', 'admin'], expired: ['system'] },
  in_production: { ready: ['vendor'], cancelled: ['vendor', 'admin'] },
  ready: { out_for_delivery: ['vendor'], cancelled: ['admin'] },
  out_for_delivery: { delivered: ['vendor'], cancelled: ['admin'] },
  delivered: {},
  declined: {},
  cancelled: {},
  expired: {},
};

export const FAB_PAID_STATUSES: FabStatus[] = ['in_production', 'ready', 'out_for_delivery'];
export const FAB_PRE_PAYMENT: FabStatus[] = ['submitted', 'quoted', 'pending_payment'];

export function canTransitionJob(from: FabStatus, to: FabStatus, actor: Actor): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}
