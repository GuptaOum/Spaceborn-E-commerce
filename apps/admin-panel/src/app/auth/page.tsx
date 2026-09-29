'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { AuthView } from '../../views/AuthView';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const { loginUser } = useStore();

  return (
    <AuthView
      initialMode={mode}
      onLoginSuccess={(user) => {
        loginUser(user);
        router.push('/catalog');
      }}
      onNavigate={(view) => {
        if (view === 'catalog') router.push('/catalog');
        else if (view === 'home') router.push('/');
        else router.push(`/${view}`);
      }}
    />
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-xs text-[#7a6274]">Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}
