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

  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);

  const handleApplyCoupon = (code: string) => {
    if (code.toUpperCase() === 'SPACE10' || code.toUpperCase() === 'MAKER10') {
      setDiscountPercent(10);
      return { success: true, message: '10% Maker discount applied!' };
    }
    return { success: false, message: 'Invalid coupon code. Try SPACE10.' };
  };

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
