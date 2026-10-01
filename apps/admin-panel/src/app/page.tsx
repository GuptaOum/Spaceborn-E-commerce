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

export type TabId = 'stores' | 'services' | 'submissions' | 'orders' | 'fab-jobs' | 'products' | 'team';

interface NavPillar {
  title: string;
  tabs: { id: TabId; label: string; globalOnly?: boolean }[];
}

const PILLARS: NavPillar[] = [
  {
    title: 'Triage Inbox',
    tabs: [
      { id: 'stores', label: 'Store applications' },
      { id: 'services', label: 'Print & CNC services' },
      { id: 'submissions', label: 'Product proposals' },
    ],
  },
  {
    title: 'Live Operations',
    tabs: [
      { id: 'orders', label: 'Orders & Delivery' },
      { id: 'fab-jobs', label: 'Print jobs' },
    ],
  },
  {
    title: 'Platform Management',
    tabs: [
      { id: 'products', label: 'Master catalog', globalOnly: true },
      { id: 'team', label: 'Admin team' },
    ],
  },
];

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
        <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">
          Sign out
        </button>
      </header>

      {!me.isGlobal && (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          You are seeing stores, orders, services and product submissions for {me.regions?.map(titleCase).join(', ')} only.
        </p>
      )}

      <Overview data={overview.data} onJump={setTab} />

      {/* 3-Tier Operational Pillars Navigation */}
      <nav className="mt-6 flex flex-wrap items-end gap-4 border-b border-slate-200 pb-3" role="tablist">
        {PILLARS.map((pillar) => {
          const visibleTabs = pillar.tabs.filter((t) => !t.globalOnly || me.isGlobal);
          if (visibleTabs.length === 0) return null;
          const pillarPendingTotal = visibleTabs.reduce((acc, t) => acc + (pending[t.id] ?? 0), 0);
          return (
            <div key={pillar.title} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>{pillar.title}</span>
                {pillarPendingTotal > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                    {pillarPendingTotal} pending
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1">
                {visibleTabs.map((t) => {
                  const n = pending[t.id];
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      {t.label}
                      {n ? (
                        <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-amber-500 text-white' : 'bg-amber-200 text-amber-900'}`}>
                          {n}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
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
