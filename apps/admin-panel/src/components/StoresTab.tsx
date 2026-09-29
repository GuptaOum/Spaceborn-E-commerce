'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { formatDateTime } from '@spaceborn/web-core/format';
import type { Store, StoreStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

type AdminStore = Store & { ownerEmail: string | null; ownerName: string | null };

const FILTERS: StoreStatus[] = ['pending', 'approved', 'suspended', 'rejected'];

export function StoresTab() {
  const [status, setStatus] = useState<StoreStatus>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(
    () => api<{ stores: AdminStore[] }>(`/admin/stores?status=${status}`).then((r) => r.stores),
    [status],
  );

  const decide = async (store: AdminStore, action: 'approve' | 'reject' | 'suspend') => {
    let reason: string | null = null;
    if (action !== 'approve') {
      reason = window.prompt(`Reason to ${action} "${store.name}" (shown to the vendor):`);
      if (!reason || reason.trim().length < 3) return;
    }
    setBusyId(store.id);
    setActionError(null);
    try {
      await api(`/admin/stores/${store.id}/${action}`, { method: 'POST', body: reason ? { reason: reason.trim() } : {} });
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatus(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              status === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {(error || actionError) && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error || actionError}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {data?.length === 0 && <p className="mt-4 text-sm text-slate-500">No {status} stores.</p>}

      <ul className="mt-4 space-y-3">
        {data?.map((store) => (
          <li key={store.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{store.name}</p>
                <p className="text-sm text-slate-600">
                  {store.addressLine}, {store.city} {store.pincode}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Owner: {store.ownerName ?? '—'} · {store.ownerEmail ?? '—'} · {store.phone}
                  {store.gstin && <> · GSTIN {store.gstin}</>}
                </p>
                <p className="text-xs text-slate-500">
                  Radius {store.deliveryRadiusKm} km · Applied {formatDateTime(store.createdAt)}
                  {store.status === 'approved' && <> · {store.isOnline ? 'Online' : 'Offline'}</>}
                </p>
                {store.reviewNote && <p className="mt-1 text-xs text-amber-700">Note: {store.reviewNote}</p>}
              </div>
              <div className="flex gap-2">
                {(store.status === 'pending' || store.status === 'suspended') && (
                  <button
                    disabled={busyId === store.id}
                    onClick={() => decide(store, 'approve')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {store.status === 'suspended' ? 'Reinstate' : 'Approve'}
                  </button>
                )}
                {store.status === 'pending' && (
                  <button
                    disabled={busyId === store.id}
                    onClick={() => decide(store, 'reject')}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                {store.status === 'approved' && (
                  <button
                    disabled={busyId === store.id}
                    onClick={() => decide(store, 'suspend')}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
