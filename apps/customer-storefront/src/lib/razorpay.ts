import type { CheckoutPayment } from '@spaceborn/web-core/types';

export interface RazorpaySuccess {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

type RazorpayCheckout = { open: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function payWithRazorpay(
  payment: CheckoutPayment,
  description: string,
  prefill: { name?: string; email?: string; contact?: string },
): Promise<RazorpaySuccess> {
  if (!payment.keyId || !(await loadRazorpay()) || !window.Razorpay) {
    throw new Error('Payment gateway could not be loaded. Check your connection and retry.');
  }
  const Checkout = window.Razorpay;
  return new Promise((resolve, reject) => {
    const checkout = new Checkout({
      key: payment.keyId,
      order_id: payment.providerOrderId,
      amount: payment.amountPaise,
      currency: payment.currency,
      name: 'Spaceborn',
      description,
      prefill,
      theme: { color: '#0c831f' },
      handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
        resolve({ razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature }),
      modal: { ondismiss: () => reject(new Error('Payment window was closed before payment completed.')) },
    });
    checkout.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'Payment failed.')));
    checkout.open();
  });
}
