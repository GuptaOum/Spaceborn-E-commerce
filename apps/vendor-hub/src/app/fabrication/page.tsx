'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { FabricationLabView } from '../../views/FabricationLabView';

export default function FabricationPage() {
  const router = useRouter();
  const { addToCart } = useStore();

  return (
    <FabricationLabView
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
      onAddToCart={addToCart}
    />
  );
}
