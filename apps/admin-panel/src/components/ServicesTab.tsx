'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { formatDateTime, formatInr, SERVICE_KIND_LABEL } from '@spaceborn/web-core/format';
import type { ListingStatus, ServiceListing, StoreStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

type AdminListing = ServiceListing & { storeName: string; city: string; storeStatus: StoreStatus; ownerEmail: string | null };

const FILTERS: ListingStatus[] = ['pending', 'approved', 'suspended', 'rejected'];

export function ServicesTab() {
  const [status, setStatus] = useState<ListingStatus>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(
    () => api<{ services: AdminListing[] }>(`/admin/services?status=${status}`).then((r) => r.services),
    [status],
  );

  const decide = async (s: AdminListing, action: 'approve' | 'reject' | 'suspend') => {
    let reason: string | null = null;
    if (action !== 'approve') {
      reason = window.prompt(`Reason to ${action} "${s.title}" (shown to the vendor):`);
      if (!reason || reason.trim().length < 3) return;
    }
    setBusyId(s.id);
    setActionError(null);
    try {
      await api(`/admin/services/${s.id}/${action}`, { method: 'POST', body: reason ? { reason: reason.trim() } : {} });
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
      {data?.length === 0 && <p className="mt-4 text-sm text-slate-500">No {status} services.</p>}

      <ul className="mt-4 space-y-3">
        {data?.map((s) => (
          <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {SERVICE_KIND_LABEL[s.kind]} · {s.title}
                </p>
                <p className="text-sm text-slate-600">
                  {s.storeName}, {s.city} · {s.ownerEmail ?? '—'}
                  {s.storeStatus !== 'approved' && <span className="ml-1 text-red-600">(store {s.storeStatus})</span>}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {s.materials.join(', ')} · max {s.maxXmm}×{s.maxYmm}×{s.maxZmm} mm · from {formatInr(s.startingPrice)} · ~
                  {s.turnaroundHours}h · submitted {formatDateTime(s.createdAt)}
                </p>
                {s.description && <p className="mt-1 text-xs text-slate-600">{s.description}</p>}
                {s.reviewNote && <p className="mt-1 text-xs text-amber-700">Note: {s.reviewNote}</p>}
              </div>
              <div className="flex gap-2">
                {(s.status === 'pending' || s.status === 'suspended') && (
                  <button
                    disabled={busyId === s.id || s.storeStatus !== 'approved'}
                    onClick={() => decide(s, 'approve')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {s.status === 'suspended' ? 'Reinstate' : 'Approve'}
                  </button>
                )}
                {s.status === 'pending' && (
                  <button
                    disabled={busyId === s.id}
                    onClick={() => decide(s, 'reject')}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                {s.status === 'approved' && (
                  <button
                    disabled={busyId === s.id}
                    onClick={() => decide(s, 'suspend')}
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
