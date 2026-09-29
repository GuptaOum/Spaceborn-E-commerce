'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { WarrantyPolicyView } from '../../views/WarrantyPolicyView';

export default function WarrantyPage() {
  const router = useRouter();

  return (
    <WarrantyPolicyView
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
    />
  );
}
