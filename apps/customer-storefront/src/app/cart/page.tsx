'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { CartReviewView } from '../../views/CartReviewView';

export default function CartPage() {
  const router = useRouter();
  const {
    cart,
    gstDetails,
    setGstDetails,
    updateQuantity,
    removeFromCart,
  } = useStore();

  const [couponCode] = useState('');
  const discountPercent = 0;

  const handleApplyCoupon = (_code: string) => ({ success: false, message: 'Coupons are not available yet.' });

  return (
    <CartReviewView
      cart={cart}
      gstDetails={gstDetails}
      onUpdateGstDetails={setGstDetails}
      onUpdateQuantity={updateQuantity}
      onRemoveItem={removeFromCart}
      onProceedToCheckout={() => router.push('/checkout')}
      onContinueShopping={() => router.push('/catalog')}
      couponCode={couponCode}
      onApplyCoupon={handleApplyCoupon}
      discountPercent={discountPercent}
    />
  );
}
