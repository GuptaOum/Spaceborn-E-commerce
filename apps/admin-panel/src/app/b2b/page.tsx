'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { B2BPortalView } from '../../views/B2BPortalView';

export default function B2BPage() {
  const router = useRouter();
  const { addToCart, currentUser } = useStore();

  return (
    <B2BPortalView
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
      onAddToCart={addToCart}
      onOpenAuth={(mode) => router.push(`/auth?mode=${mode || 'login'}`)}
      user={currentUser}
    />
  );
}
