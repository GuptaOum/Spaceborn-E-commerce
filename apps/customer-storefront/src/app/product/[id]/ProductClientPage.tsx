'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../../context/StoreContext';
import { ProductDetailView } from '../../../views/ProductDetailView';
import { Product } from '../../../types';

export default function ProductClientPage({ productId }: { productId: string }) {
  const router = useRouter();
  const { products, addToCart, setSelectedProduct, catalogStatus } = useStore();

  const product = products.find((p) => p.id === productId);

  if (!product && catalogStatus === 'loading') {
    return <div className="min-h-[50vh] flex items-center justify-center text-xs text-[#7a6274]">Loading...</div>;
  }

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    router.push(`/product/${prod.id}`);
  };

  const handleBuyNow = (prod: Product, qty: number) => {
    addToCart(prod, qty);
    router.push('/checkout');
  };

  if (!product) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-sm font-bold text-[#7a6274]">This product is not available at the store near you.</p>
      </div>
    );
  }

  return (
    <ProductDetailView
      product={product}
      allProducts={products}
      onAddToCart={addToCart}
      onBuyNow={handleBuyNow}
      onSelectProduct={handleSelectProduct}
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
    />
  );
}
