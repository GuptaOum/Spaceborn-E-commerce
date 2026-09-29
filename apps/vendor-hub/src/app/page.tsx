'use client';

import React from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { VendorPortalView } from '../views/VendorPortalView';

export default function VendorHomePage() {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    setSelectedProduct,
  } = useStore();

  const { user } = useAuth();

  return (
    <VendorPortalView
      products={products}
      onAddProduct={addProduct}
      onUpdateProduct={updateProduct}
      onDeleteProduct={deleteProduct}
      onSelectProduct={setSelectedProduct}
      onNavigate={() => {}}
      user={user}
    />
  );
}
