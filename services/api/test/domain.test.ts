import { describe, expect, it } from 'vitest';
import { haversineKm } from '../src/lib/geo.js';
import { deliveryFee, etaMinutes, FREE_DELIVERY_THRESHOLD, PLATFORM_FEE, priceOrder, toPaise } from '../src/orders/pricing.js';
import { canTransition, nextStatusesFor } from '../src/orders/status.js';
import { hmacSha256Hex, verifyPaymentSignature, verifyWebhookSignature } from '../src/payments/signatures.js';

describe('pricing', () => {
  it('waives delivery above the free threshold', () => {
    expect(deliveryFee(FREE_DELIVERY_THRESHOLD, 7)).toBe(0);
  });

  it('charges base fee within included distance and per started km beyond it', () => {
    expect(deliveryFee(100, 1.5)).toBe(25);
    expect(deliveryFee(100, 3.2)).toBe(25 + 2 * 6);
  });

  it('prices an order on server-side unit prices', () => {
    const result = priceOrder([{ unitPrice: 185, quantity: 2 }, { unitPrice: 49.5, quantity: 1 }], 1);
    expect(result.itemsTotal).toBe(419.5);
    expect(result.grandTotal).toBe(419.5 + 25 + PLATFORM_FEE);
  });

  it('converts rupees to paise without float drift', () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(449.99)).toBe(44999);
  });

  it('estimates delivery time from prep and distance', () => {
    expect(etaMinutes(8, 0)).toBe(11);
    expect(etaMinutes(8, 3.5)).toBe(21);
  });
});

describe('order status machine', () => {
  it('only lets the system confirm payment', () => {
    expect(canTransition('pending_payment', 'placed', 'system')).toBe(true);
    expect(canTransition('pending_payment', 'placed', 'customer')).toBe(false);
    expect(canTransition('pending_payment', 'placed', 'vendor')).toBe(false);
  });

  it('stops customers cancelling once the store accepted', () => {
    expect(canTransition('placed', 'cancelled', 'customer')).toBe(true);
    expect(canTransition('accepted', 'cancelled', 'customer')).toBe(false);
  });

  it('never leaves terminal states', () => {
    for (const actor of ['customer', 'vendor', 'admin', 'system'] as const) {
      expect(nextStatusesFor('delivered', actor)).toEqual([]);
      expect(nextStatusesFor('cancelled', actor)).toEqual([]);
      expect(nextStatusesFor('expired', actor)).toEqual([]);
    }
  });

  it('walks the vendor fulfilment path in order', () => {
    expect(nextStatusesFor('placed', 'vendor')).toContain('accepted');
    expect(canTransition('placed', 'packing', 'vendor')).toBe(false);
    expect(canTransition('ready_for_pickup', 'out_for_delivery', 'vendor')).toBe(true);
    expect(canTransition('out_for_delivery', 'delivered', 'vendor')).toBe(true);
  });
});

describe('razorpay signatures', () => {
  const secret = 'test_secret';

  it('accepts a correct payment signature and rejects tampering', () => {
    const signature = hmacSha256Hex(secret, 'order_1|pay_1');
    expect(verifyPaymentSignature('order_1', 'pay_1', signature, secret)).toBe(true);
    expect(verifyPaymentSignature('order_1', 'pay_2', signature, secret)).toBe(false);
    expect(verifyPaymentSignature('order_1', 'pay_1', 'abcd', secret)).toBe(false);
  });

  it('verifies webhooks over the raw body', () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const signature = hmacSha256Hex(secret, body);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from('{"event":"payment.captured" }'), signature, secret)).toBe(false);
  });
});

describe('geo', () => {
  it('measures distance between Bengaluru landmarks', () => {
    const km = haversineKm(12.9352, 77.6245, 12.9716, 77.5946);
    expect(km).toBeGreaterThan(4.5);
    expect(km).toBeLessThan(5.5);
  });
});
