'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { VendorPortalView } from '../../views/VendorPortalView';
import { Product } from '../../types';

export default function VendorPage() {
  const router = useRouter();
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    setSelectedProduct,
    currentUser,
  } = useStore();

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    router.push(`/product/${prod.id}`);
  };

  return (
    <VendorPortalView
      products={products}
      onAddProduct={addProduct}
      onUpdateProduct={updateProduct}
      onDeleteProduct={deleteProduct}
      onSelectProduct={handleSelectProduct}
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
      user={currentUser}
    />
  );
}
