'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime } from '@spaceborn/web-core/format';
import type { Store, StoreStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FilterChips, ListState, StatusBadge } from './ui';

type AdminStore = Store & { ownerEmail: string | null; ownerName: string | null };
type Decision = 'approve' | 'reject' | 'suspend';

const FILTERS: StoreStatus[] = ['pending', 'approved', 'suspended', 'rejected'];
const VERB: Record<Decision, string> = { approve: 'approved', reject: 'rejected', suspend: 'suspended' };

export function StoresTab({ counts, onDecided }: { counts?: Record<string, number>; onDecided: () => void }) {
  const { prompt, confirm } = useFeedback();
  const [status, setStatus] = useState<StoreStatus>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const stores = useLoad(() => api<{ stores: AdminStore[] }>(`/admin/stores?status=${status}`).then((r) => r.stores), [status]);

  const [decide] = useAction(
    async (store: AdminStore, action: Decision) => {
      let reason: string | null = null;
      if (action === 'approve') {
        const ok = await confirm({
          title: store.status === 'suspended' ? `Reinstate ${store.name}?` : `Approve ${store.name}?`,
          body: `${store.ownerEmail ?? 'The owner'} gets vendor access and can list stock for customers within ${store.deliveryRadiusKm} km of ${store.city}.`,
          confirmLabel: store.status === 'suspended' ? 'Reinstate' : 'Approve',
        });
        if (!ok) return '';
      } else {
        reason = await prompt({
          title: `${action === 'reject' ? 'Reject' : 'Suspend'} ${store.name}?`,
          body: 'The vendor sees this reason in their Seller Hub.',
          label: 'Reason',
          minLength: 3,
          multiline: true,
          confirmLabel: action === 'reject' ? 'Reject' : 'Suspend',
          danger: true,
        });
        if (!reason) return '';
      }
      setBusyId(store.id);
      try {
        await api(`/admin/stores/${store.id}/${action}`, { method: 'POST', body: reason ? { reason } : {} });
        stores.mutate((list) => list?.filter((s) => s.id !== store.id) ?? list); // it now lives under another filter
        onDecided();
        return `${store.name} ${VERB[action]}`;
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  return (
    <div>
      <FilterChips options={FILTERS} value={status} onChange={setStatus} counts={counts} />
      <ListState loading={stores.loading} error={stores.error} empty={stores.data?.length === 0 ? `No ${status} stores.` : null}>
        <ul className="mt-4 space-y-3">
          {stores.data?.map((store) => {
            const busy = busyId === store.id;
            return (
              <li key={store.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      {store.name}
                      <StatusBadge status={store.status} />
                      {store.status === 'approved' && (
                        <span className={`text-xs font-semibold ${store.isOnline ? 'text-emerald-700' : 'text-slate-400'}`}>{store.isOnline ? '● online' : '○ offline'}</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-600">
                      {store.addressLine}, {store.city} {store.pincode}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Owner: {store.ownerName ?? '—'} · {store.ownerEmail ?? '—'} · {store.phone}
                      {store.gstin && <> · GSTIN {store.gstin}</>}
                    </p>
                    <p className="text-xs text-slate-500">
                      Radius {store.deliveryRadiusKm} km · at {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)} · Applied {formatDateTime(store.createdAt)}
                    </p>
                    {store.reviewNote && <p className="mt-1 text-xs text-amber-700">Note: {store.reviewNote}</p>}
                  </div>
                  <div className="flex gap-2">
                    {(store.status === 'pending' || store.status === 'suspended') && (
                      <button disabled={busy} onClick={() => void decide(store, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                        {busy ? 'Working…' : store.status === 'suspended' ? 'Reinstate' : 'Approve'}
                      </button>
                    )}
                    {store.status === 'pending' && (
                      <button disabled={busy} onClick={() => void decide(store, 'reject')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
                        Reject
                      </button>
                    )}
                    {store.status === 'approved' && (
                      <button disabled={busy} onClick={() => void decide(store, 'suspend')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </ListState>
    </div>
  );
}
