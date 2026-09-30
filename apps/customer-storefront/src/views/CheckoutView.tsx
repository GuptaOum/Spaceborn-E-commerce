'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { api, ApiError, newIdempotencyKey } from '@spaceborn/web-core/api';
import type { CartResolution, CheckoutPayment, Order } from '@spaceborn/web-core/types';
import { useStore } from '../context/StoreContext';
import { payWithRazorpay } from '../lib/razorpay';
import type { AppView } from '../types';

interface PlaceOrderResponse {
  order: Order;
  payment: CheckoutPayment;
}

interface CheckoutViewProps {
  onNavigate?: (view: AppView) => void;
}

interface AddressForm {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  pincode: string;
}

const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(-10);

export function CheckoutView({ onNavigate }: CheckoutViewProps) {
  const router = useRouter();
  const { cart, clearCart, removeFromCart, currentUser, authLoading, location, catalogStatus } = useStore();
  const [resolution, setResolution] = useState<CartResolution | null>(null);
  const [resolving, setResolving] = useState(false);

  const [address, setAddress] = useState<AddressForm>({
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    landmark: '',
    city: location.label === 'Current location' ? '' : location.label,
    pincode: location.pincode,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // One key per checkout attempt so a double click or retry never creates two orders.
  const idempotencyKey = useRef(newIdempotencyKey());

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  useEffect(() => {
    if (!currentUser) return;
    setAddress((a) => ({ ...a, fullName: a.fullName || currentUser.fullName, phone: a.phone || currentUser.phone }));
  }, [currentUser]);

  // Ask the server which nearby store would take this cart, so fees and ETA are exact before paying.
  const cartKey = cart.map((i) => `${i.product.id}:${i.quantity}`).join(',');
  useEffect(() => {
    if (!cart.length) return;
    const controller = new AbortController();
    setResolving(true);
    api<CartResolution>('/catalog/resolve', {
      method: 'POST',
      signal: controller.signal,
      body: { lat: location.latitude, lng: location.longitude, items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })) },
    })
      .then(setResolution)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 0)) setResolution(null);
      })
      .finally(() => setResolving(false));
    return () => controller.abort();
  }, [cartKey, location.latitude, location.longitude, cart.length]);

  const unavailable = new Set(resolution?.unavailable ?? []);
  const elsewhere = new Set(resolution?.elsewhere ?? []);
  const canOrder = Boolean(resolution?.store) && unavailable.size === 0 && elsewhere.size === 0;

  const navigateTo = (view: AppView) => (onNavigate ? onNavigate(view) : router.push(`/${view}`));
  const update = (field: keyof AddressForm, value: string) => setAddress((a) => ({ ...a, [field]: value }));

  const payOrder = async (placed: PlaceOrderResponse) => {
    setProcessingStep('Complete the payment in Razorpay…');
    const result = await payWithRazorpay(placed.payment, `Order #${placed.order.orderNumber}`, {
      name: address.fullName,
      email: currentUser?.email,
      contact: normalizePhone(address.phone),
    });
    setProcessingStep('Verifying payment…');
    await api('/payments/razorpay/verify', { method: 'POST', body: { orderId: placed.order.id, ...result } });
  };

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!currentUser) {
      router.push('/auth?next=/checkout');
      return;
    }
    if (!resolution?.store) {
      setErrorMessage('No store delivers to your selected location yet. Change the location from the header.');
      return;
    }
    if (unavailable.size || elsewhere.size) {
      setErrorMessage('Remove the marked items to continue.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(normalizePhone(address.phone))) {
      setErrorMessage('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!/^\d{6}$/.test(address.pincode)) {
      setErrorMessage('Enter a valid 6-digit PIN code.');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Reserving your items…');
    try {
      const placed = await api<PlaceOrderResponse>('/orders', {
        method: 'POST',
        idempotencyKey: idempotencyKey.current,
        body: {
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          address: {
            fullName: address.fullName.trim(),
            phone: normalizePhone(address.phone),
            line1: address.line1.trim(),
            line2: address.line2.trim() || undefined,
            landmark: address.landmark.trim() || undefined,
            city: address.city.trim(),
            pincode: address.pincode,
            latitude: location.latitude,
            longitude: location.longitude,
          },
        },
      });

      if (placed.order.status === 'pending_payment') {
        if (placed.payment.provider === 'razorpay') {
          await payOrder(placed);
        } else {
          setProcessingStep('Confirming test payment…');
          await api('/payments/mock/confirm', { method: 'POST', body: { orderId: placed.order.id } });
        }
      }

      clearCart();
      idempotencyKey.current = newIdempotencyKey();
      navigateTo('orders');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        idempotencyKey.current = newIdempotencyKey();
        const details = error.details as { items?: { productId: string; reason?: string }[] } | undefined;
        if (details?.items?.length) {
          const split = details.items.filter((i) => i.reason === 'split_required').map((i) => i.productId);
          const gone = details.items.filter((i) => i.reason !== 'split_required').map((i) => i.productId);
          setResolution((r) => (r ? { ...r, unavailable: gone, elsewhere: split } : r));
        }
      }
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

  const fieldClass =
    'mt-1.5 w-full rounded-lg border border-[#f9bf8f]/70 bg-white px-3 py-2.5 text-sm text-[#34222e] outline-none transition focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10';

  const field = (label: string, key: keyof AddressForm, props: React.InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => (
    <label className={`text-xs font-semibold text-[#7a6274] ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      <input className={fieldClass} value={address[key]} onChange={(e) => update(key, e.target.value)} {...props} />
    </label>
  );

  return (
    <div className="min-h-screen bg-[#fee9d7] py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 md:flex-row">
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

          {!authLoading && !currentUser && (
            <div className="rounded-lg border border-[#f9bf8f] bg-white p-3 text-sm text-[#34222e]">
              You need to{' '}
              <button type="button" onClick={() => router.push('/auth?next=/checkout')} className="font-bold text-[#0c831f] underline">
                sign in
              </button>{' '}
              before placing an order.
            </div>
          )}

          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <h2 className="mb-1 font-semibold text-[#34222e]">Delivery details</h2>
            <p className="mb-3 text-xs text-[#7a6274]">
              Delivering near <b>{location.area}</b>
              {resolution?.store
                ? ` · fulfilled by ${resolution.store.name} (${resolution.store.distanceKm} km away, ~${resolution.store.etaMinutes} min)`
                : resolving
                  ? ' · finding the fastest store…'
                  : ''}
              .
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {field('Full Name *', 'fullName', { autoComplete: 'name', required: true, minLength: 2 })}
              {field('Mobile Number *', 'phone', { autoComplete: 'tel', type: 'tel', required: true, placeholder: '98765 43210' })}
              {field('Flat / House No., Building, Street *', 'line1', { autoComplete: 'address-line1', required: true, minLength: 3 }, true)}
              {field('Area / Locality', 'line2', { autoComplete: 'address-line2' })}
              {field('Landmark', 'landmark')}
              {field('City *', 'city', { autoComplete: 'address-level2', required: true })}
              {field('PIN Code *', 'pincode', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 6, required: true })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#0c831f]/20 bg-[#f2fcf4] p-4 text-xs text-[#0c831f]">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold text-[#0c831f]">Pay securely via Razorpay</p>
                <p className="mt-0.5 text-slate-600">
                  UPI, cards, net banking and wallets. Prices and stock are confirmed by the store when you pay; card details never
                  touch Spaceborn servers.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing || catalogStatus !== 'ready' || resolving || !canOrder}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c831f] px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-[#096618] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {processingStep || 'Processing...'}
              </>
            ) : currentUser ? (
              'Place order & pay'
            ) : (
              'Sign in to place order'
            )}
          </button>
        </form>

        <aside className="h-fit w-full space-y-4 md:w-80">
          <div className="rounded-3xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-[#34222e]">Order Summary</h2>
            <div className="mb-4 max-h-56 space-y-2.5 overflow-y-auto">
              {cart.map((item) => {
                const line = resolution?.lines.find((l) => l.productId === item.product.id);
                const price = line?.unitPrice ?? item.unitPrice;
                const splitOnly = elsewhere.has(item.product.id);
                const missing = unavailable.has(item.product.id) || splitOnly;
                return (
                  <div key={item.product.id} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className={`truncate ${missing ? 'text-[#e2434b] line-through' : 'text-[#7a6274]'}`}>
                        {item.quantity}x {item.product.name}
                      </span>
                      <span className="font-semibold text-[#34222e]">₹{(price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                    {missing && (
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="mt-0.5 text-xs font-semibold text-[#e2434b] underline cursor-pointer"
                      >
                        {splitOnly
                          ? 'Sold nearby, but not by the store with the rest of your cart · remove to order separately'
                          : 'Not available nearby right now · remove'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5 border-t border-[#f9bf8f]/40 pt-3 text-sm">
              {resolution?.pricing ? (
                <>
                  <div className="flex justify-between text-[#7a6274]">
                    <span>Items</span>
                    <span>₹{resolution.pricing.itemsTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-[#7a6274]">
                    <span>Delivery{resolution.store ? ` · ${resolution.store.distanceKm} km` : ''}</span>
                    <span>{resolution.pricing.deliveryFee === 0 ? 'Free' : `₹${resolution.pricing.deliveryFee.toLocaleString('en-IN')}`}</span>
                  </div>
                  <div className="flex justify-between text-[#7a6274]">
                    <span>Platform fee</span>
                    <span>₹{resolution.pricing.platformFee.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#f9bf8f]/40 pt-2 font-bold text-[#34222e]">
                    <span>To pay</span>
                    <span>₹{resolution.pricing.grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-bold text-[#34222e]">
                  <span>Items</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
              )}
              <p className="pt-1 text-xs text-[#7a6274]">
                Delivery is free above ₹499. The nearest store with your items in stock fulfils the order.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
