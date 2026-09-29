'use client';

import { useEffect, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAuth } from '@spaceborn/web-core/auth';
import { SignInPanel } from '@spaceborn/web-core/sign-in';
import type { Store } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { ApplicationForm } from '@/components/ApplicationForm';
import { Dashboard } from '@/components/Dashboard';

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm text-slate-600">{children}</div>
    </div>
  );
}

export default function VendorHome() {
  const { user, loading, signOut, refreshClaims } = useAuth();
  const storeQuery = useLoad(
    () => (user ? api<{ store: Store | null }>('/vendor/store').then((r) => r.store) : Promise.resolve(null)),
    [user?.uid],
  );
  const [claimsRefreshed, setClaimsRefreshed] = useState(false);
  const store = storeQuery.data;

  const claimsMatch = user?.role === 'vendor' && user.storeId === store?.id;

  // Approval sets the vendor claim server-side; pull a fresh token once to pick it up.
  useEffect(() => {
    if (store?.status === 'approved' && !claimsMatch && !claimsRefreshed) {
      setClaimsRefreshed(true);
      void refreshClaims();
    }
  }, [store?.status, claimsMatch, claimsRefreshed, refreshClaims]);

  if (loading) return <p className="p-10 text-center text-sm text-slate-500">Loading…</p>;
  if (!user) {
    return <SignInPanel title="Spaceborn Seller Hub" subtitle="Sign in to apply or manage your store." allowSignUp />;
  }

  const header = (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="font-bold">Spaceborn Seller Hub</p>
        <p className="text-xs text-slate-500">{user.email}</p>
      </div>
      <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">
        Sign out
      </button>
    </header>
  );

  let body: React.ReactNode;
  if (user.role === 'admin') {
    body = <Notice title="Admin account">Admin accounts cannot run a store. Use a separate account to sell.</Notice>;
  } else if (storeQuery.loading && !store) {
    body = <p className="p-10 text-center text-sm text-slate-500">Loading your store…</p>;
  } else if (storeQuery.error) {
    body = <Notice title="Could not load your store">{storeQuery.error}</Notice>;
  } else if (!store) {
    body = <ApplicationForm onSubmitted={storeQuery.reload} />;
  } else if (store.status === 'pending') {
    body = (
      <Notice title="Application under review">
        <p>
          <b>{store.name}</b> is waiting for approval. You will be able to list products and take orders once an admin
          approves it.
        </p>
        <button onClick={storeQuery.reload} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold">
          Check again
        </button>
      </Notice>
    );
  } else if (store.status === 'rejected') {
    body = (
      <>
        <Notice title="Application not approved">
          <p>Reason: {store.reviewNote ?? 'No reason given.'}</p>
          <p>Fix the details below and submit again.</p>
        </Notice>
        <ApplicationForm initial={store} onSubmitted={storeQuery.reload} />
      </>
    );
  } else if (store.status === 'suspended') {
    body = (
      <Notice title="Store suspended">
        <p>Reason: {store.reviewNote ?? 'Contact Spaceborn support.'}</p>
      </Notice>
    );
  } else if (!claimsMatch) {
    body = (
      <Notice title="Almost there">
        <p>Your store was approved. Refreshing your access…</p>
        <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold">
          Still stuck? Sign out and back in
        </button>
      </Notice>
    );
  } else {
    body = <Dashboard initialStore={store} />;
  }

  return (
    <div className="min-h-screen">
      {header}
      {body}
    </div>
  );
}
