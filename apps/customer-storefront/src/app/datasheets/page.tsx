'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { DatasheetLibraryView } from '../../views/DatasheetLibraryView';
import { Product } from '../../types';

export default function DatasheetsPage() {
  const router = useRouter();
  const { products, setSelectedProduct } = useStore();

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    router.push(`/product/${prod.id}`);
  };

  return (
    <DatasheetLibraryView
      products={products}
      onSelectProduct={handleSelectProduct}
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
    />
  );
}
