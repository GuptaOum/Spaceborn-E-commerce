'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ShieldCheck, Truck, Lock } from 'lucide-react';
import { AppView } from '../types';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from '../components/CheckoutForm';

// Initialize Stripe outside of component to avoid recreating the object on every render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface CheckoutViewProps {
  onNavigate: (view: AppView) => void;
}

export function CheckoutView({ onNavigate }: CheckoutViewProps) {
  const { cart, clearCart, currentUser } = useStore();
  const [clientSecret, setClientSecret] = useState('');
  
  const totalAmount = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFee = totalAmount > 500 ? 0 : 49;
  const finalTotal = totalAmount + deliveryFee;

  useEffect(() => {
    // Call our AWS-ready API route to create a PaymentIntent
    if (finalTotal > 0) {
      fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: finalTotal,
          customerId: currentUser?.id || 'guest',
          orderId: `order-${Date.now()}`
        }),
      })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      })
      .catch((err) => console.error("Failed to create payment intent:", err));
    }
  }, [finalTotal, currentUser]);

  const handlePaymentSuccess = () => {
    // Generate a new order and add it to the local state
    const newOrder = {
      id: `ord_${Date.now()}`,
      items: [...cart],
      total: finalTotal,
      status: 'placed' as const,
      date: new Date().toISOString(),
      handoverPin: Math.floor(1000 + Math.random() * 9000).toString(),
    };
    
    // Make sure addOrder exists in useStore if you export it
    // addOrder(newOrder); 
    
    clearCart();
    onNavigate('orders');
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold mb-4">Your cart is empty</h2>
        <button onClick={() => onNavigate('catalog')} className="px-6 py-2 bg-[#0c831f] text-white rounded-lg">Browse Components</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fee9d7] py-8">
      <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row gap-6">
        
        {/* Left Column - Payment */}
        <div className="flex-1 bg-[#fffbf7] rounded-3xl p-6 border border-[#f9bf8f]/60 shadow-sm">
          <h2 className="text-xl font-bold text-[#34222e] mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#0c831f]" /> Secure Checkout
          </h2>
          
          {clientSecret ? (
            <Elements options={{ clientSecret, appearance: { theme: 'stripe' } }} stripe={stripePromise}>
              <CheckoutForm amount={finalTotal} onSuccess={handlePaymentSuccess} />
            </Elements>
          ) : (
            <div className="flex items-center justify-center p-12 text-[#7a6274]">
              <div className="spinner border-2 border-t-2 border-[#0c831f] rounded-full w-8 h-8 animate-spin"></div>
              <span className="ml-3 font-medium">Initializing secure payment...</span>
            </div>
          )}
        </div>

        {/* Right Column - Order Summary */}
        <div className="w-full md:w-80 space-y-4">
          <div className="bg-[#fffbf7] rounded-3xl p-5 border border-[#f9bf8f]/60 shadow-sm">
            <h3 className="font-bold text-[#34222e] mb-3">Order Summary</h3>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span className="text-[#7a6274] truncate pr-2">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="font-semibold text-[#34222e]">₹{(item.unitPrice * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            
            <div className="border-t border-[#f9bf8f]/40 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-[#7a6274]">
                <span>Subtotal</span>
                <span>₹{totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#7a6274]">
                <span>Delivery (10 mins)</span>
                <span>{deliveryFee === 0 ? <span className="text-[#0c831f] font-bold">FREE</span> : `₹${deliveryFee}`}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-[#34222e] pt-2 border-t border-[#f9bf8f]/40">
                <span>Total Pay</span>
                <span>₹{finalTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#f2fcf4] border border-[#0c831f]/20 rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0c831f] shrink-0 mt-0.5" />
            <p className="text-xs text-[#0c831f]">
              Payments are securely processed by Stripe. Your card details are never stored on Spaceborn servers.
            </p>
          </div>
        </div>
        
      </div>
    </div>
  );
}
