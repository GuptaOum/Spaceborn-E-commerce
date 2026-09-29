'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ContactView } from '../../views/ContactView';

export default function ContactPage() {
  const router = useRouter();

  return (
    <ContactView
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
    />
  );
}
