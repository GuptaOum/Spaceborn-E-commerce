'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AboutView } from '../../views/AboutView';

export default function AboutPage() {
  const router = useRouter();

  return (
    <AboutView
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
    />
  );
}
