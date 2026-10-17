'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@spaceborn/web-core/api';
import type { CatalogOffer } from '@spaceborn/web-core/types';
import { toProduct, useStore } from '../../../context/StoreContext';
import { ProductDetailView } from '../../../views/ProductDetailView';
import { Product } from '../../../types';

export default function ProductClientPage({ productId }: { productId: string }) {
  const router = useRouter();
  const { products, searchResults, addToCart, setSelectedProduct, catalogStatus, location } = useStore();

  const listed = products.find((p) => p.id === productId) ?? searchResults?.find((p) => p.id === productId);
  const [fetched, setFetched] = useState<{ key: string; product: Product | null } | null>(null);
  const fetchKey = `${productId}:${location.latitude}:${location.longitude}`;

  useEffect(() => {
    if (listed || catalogStatus === 'loading') return;
    let cancelled = false;
    api<{ product: CatalogOffer }>(
      `/catalog/products/${encodeURIComponent(productId)}?lat=${location.latitude}&lng=${location.longitude}`,
    )
      .then((res) => !cancelled && setFetched({ key: fetchKey, product: toProduct(res.product) }))
      .catch(() => !cancelled && setFetched({ key: fetchKey, product: null }));
    return () => {
      cancelled = true;
    };
  }, [listed, catalogStatus, productId, location.latitude, location.longitude, fetchKey]);

  const product = listed ?? (fetched?.key === fetchKey ? fetched.product : undefined);

  if (product === undefined) {
    return <div className="min-h-[50vh] flex items-center justify-center text-xs text-sb-muted">Loading...</div>;
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
        <p className="text-sm font-bold text-sb-muted">This product is not available at the store near you.</p>
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
