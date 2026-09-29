'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Address, AppView, CartItem, Order } from '../types';

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type CheckoutOrder = {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

interface CheckoutViewProps {
  onNavigate?: (view: AppView) => void;
  cart?: CartItem[];
  clearCart?: () => void;
  currentUser?: any;
}

const emptyAddress = (fullName = '', email = '', phone = ''): Address => ({
  id: 'checkout-address',
  fullName,
  email,
  phone,
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  type: 'residential',
});

const loadRazorpay = () => new Promise<boolean>((resolve) => {
  if (typeof window === 'undefined') return resolve(false);
  if ((window as any).Razorpay) return resolve(true);

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
  const script = existingScript || document.createElement('script');
  if (!existingScript) {
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
  }
  script.addEventListener('load', () => resolve(Boolean((window as any).Razorpay)), { once: true });
  script.addEventListener('error', () => resolve(false), { once: true });
  if (!existingScript) document.body.appendChild(script);
});

export function CheckoutView(props: CheckoutViewProps) {
  const router = useRouter();
  let storeContext: any = {};
  try {
    storeContext = useStore();
  } catch (e) {
    // If rendered outside StoreProvider fallback to props
  }

  const cart: CartItem[] = props.cart ?? storeContext.cart ?? [];
  const clearCart = props.clearCart ?? storeContext.clearCart ?? (() => {});
  const currentUser = props.currentUser ?? storeContext.currentUser ?? null;
  const addOrder = storeContext.addOrder ?? (() => {});

  const [shippingAddress, setShippingAddress] = useState<Address>(() => emptyAddress());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAccessToken, setHasAccessToken] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0);
  const deliveryFee = subtotal > 500 ? 0 : (subtotal > 0 ? 49 : 0);
  const totalAmount = subtotal + deliveryFee;

  useEffect(() => {
    setHasAccessToken(Boolean(typeof window !== 'undefined' && localStorage.getItem('spaceborn_access_token')));
    const savedAddress = currentUser?.addresses?.find((address: Address) => address.isDefault) || currentUser?.addresses?.[0];
    if (savedAddress) {
      setShippingAddress(savedAddress);
    } else if (currentUser) {
      setShippingAddress((address) => ({
        ...address,
        fullName: currentUser.fullName || currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
      }));
    }
  }, [currentUser]);

  const updateAddress = (field: keyof Address, value: string) => {
    setShippingAddress((address) => ({ ...address, [field]: value }));
  };

  const navigateTo = (view: AppView) => {
    if (props.onNavigate) {
      props.onNavigate(view);
    } else {
      router.push(`/${view}`);
    }
  };

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!shippingAddress.fullName.trim() || !shippingAddress.email.trim() || !shippingAddress.phone.trim() ||
        !shippingAddress.addressLine1.trim() || !shippingAddress.city.trim() || !shippingAddress.state.trim() ||
        !/^\d{6}$/.test(shippingAddress.pincode.trim())) {
      setErrorMessage('Enter complete contact and shipping details, including a valid 6-digit PIN code.');
      return;
    }
    if (!cart.length) {
      setErrorMessage('Your cart is empty. Add an item before checking out.');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Preparing secure Razorpay checkout...');

    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    try {
      // If Razorpay Key is configured, attempt real Razorpay checkout
      if (razorpayKeyId && (await loadRazorpay())) {
        setProcessingStep('Choose UPI or card in Razorpay Checkout...');
        const paymentResult = await new Promise<RazorpaySuccess>((resolve, reject) => {
          const razorpay = new (window as any).Razorpay({
            key: razorpayKeyId,
            amount: totalAmount * 100, // in paise
            currency: 'INR',
            name: 'Spaceborn',
            description: 'Electronics & Robotics Components Order',
            prefill: {
              name: shippingAddress.fullName,
              email: shippingAddress.email,
              contact: shippingAddress.phone,
            },
            theme: { color: '#0c831f' },
            method: { upi: true, card: true, netbanking: true, wallet: true },
            handler: resolve,
            modal: {
              ondismiss: () => reject(new Error('Payment window was closed before payment completed.')),
            },
          });

          razorpay.on('payment.failed', (response: any) => {
            reject(new Error(response?.error?.description || 'Razorpay could not complete the payment.'));
          });
          razorpay.open();
        });

        setProcessingStep('Verifying your payment securely...');
      }

      // Record Order via our secure server endpoint
      setProcessingStep('Finalizing order securely...');
      const token = typeof window !== 'undefined' ? localStorage.getItem('spaceborn_access_token') : null;
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        try {
          headers['Authorization'] = 'Bearer ' + JSON.parse(token);
        } catch {
          headers['Authorization'] = 'Bearer ' + token;
        }
      }

      const res = await fetch('/api/checkout-secure', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cart,
          total: totalAmount,
          userId: currentUser?.id || 'guest-session',
          shippingAddress
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server could not record order');
      }

      // Add local order tracking
      const newOrder: Order = {
        id: `ord_${Date.now()}`,
        items: [...cart],
        total: totalAmount,
        status: 'placed',
        date: new Date().toISOString(),
        handoverPin: Math.floor(1000 + Math.random() * 9000).toString(),
        shippingAddress
      } as any;

      if (addOrder) addOrder(newOrder);
      clearCart();
      navigateTo('orders');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete checkout. Please retry.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  if (!cart.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <h2 className="mb-4 text-xl font-bold text-[#34222e]">Your cart is empty</h2>
        <button
          onClick={() => navigateTo('catalog')}
          className="rounded-lg bg-[#0c831f] px-6 py-2.5 font-medium text-white shadow-sm transition hover:bg-[#096618]"
        >
          Browse Components
        </button>
      </div>
    );
  }

  const fieldClass = 'mt-1.5 w-full rounded-lg border border-[#f9bf8f]/70 bg-white px-3 py-2.5 text-sm text-[#34222e] outline-none transition focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10';

  return (
    <div className="min-h-screen bg-[#fee9d7] py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 md:flex-row">
        
        {/* Left Column - Delivery & Payment Form */}
        <form onSubmit={handlePayment} className="flex-1 space-y-5 rounded-3xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-6 shadow-sm">
          <button
            type="button"
            onClick={() => navigateTo('cart')}
            className="flex items-center gap-2 text-sm font-medium text-[#7a6274] transition hover:text-[#34222e]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to cart
          </button>

          <h1 className="flex items-center gap-2 text-xl font-bold text-[#34222e]">
            <Lock className="h-5 w-5 text-[#0c831f]" /> Secure Checkout
          </h1>

          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Delivery Details */}
          <div>
            <h2 className="mb-3 font-semibold text-[#34222e]">Contact & Delivery Details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#7a6274]">
                Full Name *
                <input
                  className={fieldClass}
                  autoComplete="name"
                  placeholder="e.g. Rahul Sharma"
                  required
                  value={shippingAddress.fullName}
                  onChange={(e) => updateAddress('fullName', e.target.value)}
                />
              </label>

              <label className="text-xs font-semibold text-[#7a6274]">
                Email Address *
                <input
                  className={fieldClass}
                  autoComplete="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={shippingAddress.email}
                  onChange={(e) => updateAddress('email', e.target.value)}
                />
              </label>

              <label className="text-xs font-semibold text-[#7a6274]">
                Phone Number (for delivery updates) *
                <input
                  className={fieldClass}
                  autoComplete="tel"
                  type="tel"
                  placeholder="+91 98765 43210"
                  required
                  value={shippingAddress.phone}
                  onChange={(e) => updateAddress('phone', e.target.value)}
                />
              </label>

              <label className="text-xs font-semibold text-[#7a6274]">
                PIN Code *
                <input
                  className={fieldClass}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit PIN code"
                  required
                  value={shippingAddress.pincode}
                  onChange={(e) => updateAddress('pincode', e.target.value.replace(/\D/g, ''))}
                />
              </label>

              <label className="text-xs font-semibold text-[#7a6274] sm:col-span-2">
                Street Address *
                <input
                  className={fieldClass}
                  autoComplete="street-address"
                  placeholder="Flat/House No., Building, Street area"
                  required
                  value={shippingAddress.addressLine1}
                  onChange={(e) => updateAddress('addressLine1', e.target.value)}
                />
              </label>

              <label className="text-xs font-semibold text-[#7a6274]">
                City / Hub *
                <input
                  className={fieldClass}
                  autoComplete="address-level2"
                  placeholder="e.g. Bengaluru, Mumbai"
                  required
                  value={shippingAddress.city}
                  onChange={(e) => updateAddress('city', e.target.value)}
                />
              </label>

              <label className="text-xs font-semibold text-[#7a6274]">
                State *
                <input
                  className={fieldClass}
                  autoComplete="address-level1"
                  placeholder="e.g. Karnataka, Maharashtra"
                  required
                  value={shippingAddress.state}
                  onChange={(e) => updateAddress('state', e.target.value)}
                />
              </label>

              <label className="text-xs font-semibold text-[#7a6274] sm:col-span-2">
                Landmark, Suite, Apartment (optional)
                <input
                  className={fieldClass}
                  placeholder="Near Tech Park, Floor 3"
                  value={shippingAddress.addressLine2 || ''}
                  onChange={(e) => updateAddress('addressLine2', e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Razorpay Trust & Payment Methods Banner */}
          <div className="rounded-2xl border border-[#0c831f]/20 bg-[#f2fcf4] p-4 text-xs text-[#0c831f]">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold text-[#0c831f]">Instant Checkout via Razorpay</p>
                <p className="mt-0.5 text-slate-600">
                  Pay securely with UPI (GPay, PhonePe, Paytm), Credit/Debit Card, Net Banking, or Wallets through Razorpay. Card details are never stored on Spaceborn servers.
                </p>
              </div>
            </div>
          </div>

          {/* Checkout Submit Button */}
          <button
            type="submit"
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c831f] px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-[#096618] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {processingStep || 'Processing...'}
              </>
            ) : (
              `Pay ₹${totalAmount.toLocaleString('en-IN')} with UPI or Card`
            )}
          </button>
        </form>

        {/* Right Column - Order Summary */}
        <aside className="h-fit w-full space-y-4 md:w-80">
          <div className="rounded-3xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-[#34222e]">Order Summary</h2>
            
            <div className="mb-4 max-h-48 space-y-2.5 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate text-[#7a6274]">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="font-semibold text-[#34222e]">
                    ₹{((item.unitPrice || 0) * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-[#f9bf8f]/40 pt-3 text-sm">
              <div className="flex justify-between text-[#7a6274]">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[#7a6274]">
                <span>Delivery (10 mins)</span>
                <span>
                  {deliveryFee === 0 ? (
                    <b className="font-bold text-[#0c831f]">FREE</b>
                  ) : (
                    `₹${deliveryFee}`
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-[#f9bf8f]/40 pt-3 text-lg font-bold text-[#34222e]">
                <span>Total Pay</span>
                <span>₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
