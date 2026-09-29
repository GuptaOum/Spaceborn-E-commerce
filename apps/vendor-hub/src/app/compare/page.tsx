'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { CompareView } from '../../views/CompareView';
import { Product } from '../../types';

export default function ComparePage() {
  const router = useRouter();
  const {
    compareList,
    removeFromCompare,
    clearCompare,
    addToCompare,
    addToCart,
    setSelectedProduct,
  } = useStore();

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    router.push(`/product/${prod.id}`);
  };

  return (
    <CompareView
      compareList={compareList}
      onRemoveFromCompare={removeFromCompare}
      onClearCompare={clearCompare}
      onAddToCompare={addToCompare}
      onAddToCart={addToCart}
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
      onSelectProduct={handleSelectProduct}
    />
  );
}
