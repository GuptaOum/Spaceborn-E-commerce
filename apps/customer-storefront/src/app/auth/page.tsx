'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@spaceborn/web-core/auth';
import { SignInPanel } from '@spaceborn/web-core/sign-in';

function safeRedirect(target: string | null) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/catalog';
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const next = safeRedirect(searchParams.get('next'));

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  if (loading || user) {
    return <div className="min-h-[50vh] flex items-center justify-center text-xs text-[#7a6274]">Loading...</div>;
  }
  return (
    <div className="py-10">
      <SignInPanel title="Sign in to Spaceborn" subtitle="Electronics delivered in minutes from stores near you." allowSignUp />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-xs text-[#7a6274]">Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}
