'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { CatalogView } from '../../views/CatalogView';
import { Product } from '../../types';

export default function CatalogPage() {
  const router = useRouter();
  const {
    products,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    addToCart,
    setSelectedProduct,
    setQuickViewProduct,
  } = useStore();

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    router.push(`/product/${prod.id}`);
  };

  return (
    <CatalogView
      products={products}
      selectedCategory={selectedCategory}
      onSelectCategory={setSelectedCategory}
      searchQuery={searchQuery}
      onSelectProduct={handleSelectProduct}
      onAddToCart={addToCart}
      onQuickView={setQuickViewProduct}
    />
  );
}
