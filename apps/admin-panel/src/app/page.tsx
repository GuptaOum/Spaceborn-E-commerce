'use client';

import { useState } from 'react';
import { useAuth } from '@spaceborn/web-core/auth';
import { SignInPanel } from '@spaceborn/web-core/sign-in';
import { FabJobsTab } from '@/components/FabJobsTab';
import { Overview } from '@/components/Overview';
import { ServicesTab } from '@/components/ServicesTab';
import { OrdersTab } from '@/components/OrdersTab';
import { ProductsTab } from '@/components/ProductsTab';
import { StoresTab } from '@/components/StoresTab';

const TABS = [
  { id: 'stores', label: 'Store applications' },
  { id: 'services', label: 'Print & CNC services' },
  { id: 'orders', label: 'Orders' },
  { id: 'fab-jobs', label: 'Print jobs' },
  { id: 'products', label: 'Master catalog' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminHome() {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<TabId>('stores');

  if (loading) return <p className="p-10 text-center text-sm text-slate-500">Loading…</p>;
  if (!user) return <SignInPanel title="Spaceborn Admin" subtitle="Sign in with an admin account." />;
  if (user.role !== 'admin') {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-lg font-bold">No admin access</h1>
        <p className="mt-2 text-sm text-slate-500">{user.email} is not an administrator.</p>
        <button onClick={signOut} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Spaceborn Admin</h1>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">
          Sign out
        </button>
      </header>

      <Overview />

      <nav className="mt-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
              tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mt-4">
        {tab === 'stores' && <StoresTab />}
        {tab === 'services' && <ServicesTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'fab-jobs' && <FabJobsTab />}
        {tab === 'products' && <ProductsTab />}
      </main>
    </div>
  );
}
