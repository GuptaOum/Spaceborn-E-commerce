'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { WishlistView } from '../../views/WishlistView';
import { Product } from '../../types';

export default function WishlistPage() {
  const router = useRouter();
  const { wishlist, removeFromWishlist, addToCart, setSelectedProduct } = useStore();

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    router.push(`/product/${prod.id}`);
  };

  return (
    <WishlistView
      wishlist={wishlist}
      onRemoveFromWishlist={removeFromWishlist}
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
