'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../context/StoreContext';
import { HomeView } from '../views/HomeView';
import { Product } from '../types';

export default function HomePage() {
  const router = useRouter();
  const {
    products,
    cart,
    addToCart,
    setSelectedProduct,
    setQuickViewProduct,
    setSelectedCategory,
  } = useStore();

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    router.push(`/product/${prod.id}`);
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    router.push('/catalog');
  };

  return (
    <HomeView
      products={products}
      cart={cart}
      onSelectProduct={handleSelectProduct}
      onAddToCart={addToCart}
      onQuickView={setQuickViewProduct}
      onSelectCategory={handleSelectCategory}
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
    />
  );
}
