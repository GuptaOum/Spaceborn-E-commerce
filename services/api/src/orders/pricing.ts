export const FREE_DELIVERY_THRESHOLD = 499;
export const BASE_DELIVERY_FEE = 25;
export const PER_KM_FEE = 6;
export const INCLUDED_KM = 2;
export const PLATFORM_FEE = 5;
export const MAX_ITEMS_PER_LINE = 50;
export const RESERVATION_MINUTES = 15;

const RIDER_KM_PER_MIN = 0.35;
const HANDOFF_BUFFER_MIN = 3;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function deliveryFee(itemsTotal: number, distanceKm: number): number {
  if (itemsTotal >= FREE_DELIVERY_THRESHOLD) return 0;
  const extraKm = Math.max(0, distanceKm - INCLUDED_KM);
  return round2(BASE_DELIVERY_FEE + Math.ceil(extraKm) * PER_KM_FEE);
}

export function etaMinutes(prepMinutes: number, distanceKm: number): number {
  return Math.ceil(prepMinutes + distanceKm / RIDER_KM_PER_MIN + HANDOFF_BUFFER_MIN);
}

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export function priceOrder(lines: PricedLine[], distanceKm: number) {
  const itemsTotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const fee = deliveryFee(itemsTotal, distanceKm);
  return {
    itemsTotal,
    deliveryFee: fee,
    platformFee: PLATFORM_FEE,
    grandTotal: round2(itemsTotal + fee + PLATFORM_FEE),
  };
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);
