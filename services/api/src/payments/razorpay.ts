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

export async function refundPayment(paymentId: string, amountPaise: number, orderId: string) {
  return razorpay().payments.refund(paymentId, { amount: amountPaise, notes: { orderId } });
}
