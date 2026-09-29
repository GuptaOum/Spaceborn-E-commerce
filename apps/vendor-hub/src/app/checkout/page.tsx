'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CheckoutView } from '../../views/CheckoutView';

export default function CheckoutPage() {
  const router = useRouter();

  return (
    <CheckoutView
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'orders') router.push('/orders');
        else if (view === 'cart') router.push('/cart');
        else router.push(`/${view}`);
      }}
    />
  );
}
