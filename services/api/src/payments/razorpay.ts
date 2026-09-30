import Razorpay from 'razorpay';
import { config } from '../config.js';

let client: Razorpay | null = null;

function razorpay(): Razorpay {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) throw new Error('Razorpay is not configured');
  client ??= new Razorpay({ key_id: config.RAZORPAY_KEY_ID, key_secret: config.RAZORPAY_KEY_SECRET });
  return client;
}

export async function createProviderOrder(orderId: string, amountPaise: number) {
  const order = await razorpay().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: orderId,
    notes: { orderId },
  });
  return { providerOrderId: order.id };
}

/**
 * The SDK cannot attach an Idempotency-Key header, and the worker calls this before it can durably
 * record success, so a timeout after Razorpay accepted the refund would refund again on retry.
 * Ask Razorpay what it already has for this payment first.
 */
export async function refundPayment(paymentId: string, amountPaise: number, orderId: string) {
  const existing = await razorpay().payments.fetchMultipleRefund(paymentId);
  const already = existing?.items?.find((r) => Number(r.amount) === amountPaise);
  if (already) return already;
  return razorpay().payments.refund(paymentId, { amount: amountPaise, notes: { orderId } });
}
