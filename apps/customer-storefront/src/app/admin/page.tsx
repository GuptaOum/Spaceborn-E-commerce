'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { AdminProductsView } from '../../views/AdminProductsView';

export default function AdminPage() {
  const router = useRouter();
  const { refreshCatalog } = useStore();

  return (
    <AdminProductsView
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
      onCatalogChanged={refreshCatalog}
    />
  );
}
