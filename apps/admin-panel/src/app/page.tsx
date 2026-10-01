'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAuth } from '@spaceborn/web-core/auth';
import { SignInPanel } from '@spaceborn/web-core/sign-in';
import type { AdminScope } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FabJobsTab } from '@/components/FabJobsTab';
import { Overview, type OverviewData } from '@/components/Overview';
import { ServicesTab } from '@/components/ServicesTab';
import { OrdersTab } from '@/components/OrdersTab';
import { ProductSubmissionsTab } from '@/components/ProductSubmissionsTab';
import { ProductsTab } from '@/components/ProductsTab';
import { StoresTab } from '@/components/StoresTab';
import { TeamTab } from '@/components/TeamTab';
import { useQueue } from '@/hooks/useQueue';

const TABS = [
  { id: 'stores', label: 'Store applications' },
  { id: 'services', label: 'Print & CNC services' },
  { id: 'submissions', label: 'Product submissions' },
  { id: 'orders', label: 'Orders' },
  { id: 'fab-jobs', label: 'Print jobs' },
  { id: 'products', label: 'Master catalog' },
  { id: 'team', label: 'Team' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const ADMIN_EMAILS = ['oumgupta555@gmail.com'];
const QUEUE_REFRESH_MS = 30_000;

const titleCase = (city: string) => city.replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminHome() {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<TabId>('stores');
  const looksAdmin = !!user && (user.role === 'admin' || (!!user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())));
  // The API decides. It reads the admin team table on every request, so a removed admin is out immediately.
  const scope = useLoad<AdminScope | null>(
    () => (looksAdmin ? api<{ admin: AdminScope }>('/admin/whoami').then((r) => r.admin) : Promise.resolve(null)),
    [looksAdmin, user?.uid],
  );
  const me = scope.data;

  const queue = useQueue(!!me);
  const overview = useLoad(() => (me ? api<{ overview: OverviewData }>('/admin/overview').then((r) => r.overview) : Promise.resolve(null)), [!!me]);
  const onDecided = useCallback(() => {
    void queue.refresh();
    void overview.refresh();
  }, [queue.refresh, overview.refresh]);

  useEffect(() => {
    if (!me) return;
    const timer = setInterval(onDecided, QUEUE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [me, onDecided]);

  if (loading || (looksAdmin && scope.loading)) return <p className="p-10 text-center text-sm text-slate-500">Loading…</p>;
  if (!user) return <SignInPanel title="Spaceborn Admin" subtitle="Sign in with an admin account." />;

  if (!looksAdmin || !me) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-lg font-bold">No admin access</h1>
        <p className="mt-2 text-sm text-slate-500">
          {user.email} is not on the admin team. Ask an owner to add this email under Team.
        </p>
        {scope.error && <p className="mt-2 text-xs text-red-600">{scope.error}</p>}
        <button onClick={signOut} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Sign out
        </button>
      </div>
    );
  }

  // Regional admins do not edit the company-wide catalog; it is hidden rather than failing on save.
  const tabs = TABS.filter((t) => t.id !== 'products' || me.isGlobal);
  const scopeLabel = me.isOwner ? 'Owner · all regions' : me.regions === null ? 'All regions' : me.regions.map(titleCase).join(', ');
  const pending: Partial<Record<TabId, number>> = {
    stores: queue.data?.stores.pending,
    services: queue.data?.services.pending,
    submissions: queue.data?.submissions.pending,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Spaceborn Admin</h1>
          <p className="text-xs text-slate-500">
            {user.email} · <span className="font-semibold text-slate-700">{scopeLabel}</span>
          </p>
        </div>
        <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">
          Sign out
        </button>
      </header>

      {!me.isGlobal && (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          You are seeing stores, orders, services and product submissions for {me.regions?.map(titleCase).join(', ')} only.
        </p>
      )}

      <Overview data={overview.data} onJump={setTab} />

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {tabs.map((t) => {
          const n = pending[t.id];
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold ${
                tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {n ? <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{n}</span> : null}
            </button>
          );
        })}
      </nav>

      <main className="mt-4">
        {tab === 'stores' && <StoresTab counts={queue.data?.stores} onDecided={onDecided} />}
        {tab === 'services' && <ServicesTab counts={queue.data?.services} onDecided={onDecided} />}
        {tab === 'submissions' && <ProductSubmissionsTab counts={queue.data?.submissions} onDecided={onDecided} />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'fab-jobs' && <FabJobsTab />}
        {tab === 'products' && me.isGlobal && <ProductsTab />}
        {tab === 'team' && <TeamTab me={me} />}
      </main>
    </div>
  );
}
