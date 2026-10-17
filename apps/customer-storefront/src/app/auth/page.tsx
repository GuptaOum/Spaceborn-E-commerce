'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@spaceborn/web-core/auth';
import { SignInPanel } from '@spaceborn/web-core/sign-in';

/**
 * Only same-site paths. Browsers read `/\evil.com` as `//evil.com`, and tabs or newlines inside a
 * URL are dropped, so prefix checks alone are not enough: resolve the path and compare origins.
 */
function safeRedirect(target: string | null) {
  const fallback = '/catalog';
  if (!target || !target.startsWith('/') || /[\\\u0000-\u001f]/.test(target)) return fallback;
  try {
    const base = 'https://spaceborn.invalid';
    const url = new URL(target, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
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
    return <div className="min-h-[50vh] flex items-center justify-center text-xs text-sb-muted">Loading...</div>;
  }
  return (
    <div className="py-10">
      <SignInPanel title="Sign in to Spaceborn" subtitle="Electronics delivered in minutes from stores near you." allowSignUp />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-xs text-sb-muted">Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}
