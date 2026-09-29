'use client';

import React from 'react';
import { AdminProductsView } from '../views/AdminProductsView';
import { useStore } from '../context/StoreContext';

export default function AdminHomePage() {
  const { refreshCatalog } = useStore();

  return (
    <AdminProductsView
      onNavigate={() => {}}
      onCatalogChanged={refreshCatalog}
    />
  );
}
