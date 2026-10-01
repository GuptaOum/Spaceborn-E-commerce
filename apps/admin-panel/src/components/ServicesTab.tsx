'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime, formatInr, SERVICE_KIND_LABEL } from '@spaceborn/web-core/format';
import type { ListingStatus, ServiceListing, StoreStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FilterChips, ListState, StatusBadge } from './ui';

type AdminListing = ServiceListing & { storeName: string; city: string; storeStatus: StoreStatus; ownerEmail: string | null };
type Decision = 'approve' | 'reject' | 'suspend';

const FILTERS: ListingStatus[] = ['pending', 'approved', 'suspended', 'rejected'];
const VERB: Record<Decision, string> = { approve: 'approved', reject: 'rejected', suspend: 'suspended' };

export function ServicesTab({ counts, onDecided }: { counts?: Record<string, number>; onDecided: () => void }) {
  const { prompt, confirm } = useFeedback();
  const [status, setStatus] = useState<ListingStatus>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const services = useLoad(() => api<{ services: AdminListing[] }>(`/admin/services?status=${status}`).then((r) => r.services), [status]);

  const [decide] = useAction(
    async (s: AdminListing, action: Decision) => {
      let reason: string | null = null;
      if (action === 'approve') {
        const ok = await confirm({
          title: `${s.status === 'suspended' ? 'Reinstate' : 'Approve'} ${SERVICE_KIND_LABEL[s.kind]} at ${s.storeName}?`,
          body: `Customers near ${s.city} will be able to book “${s.title}” from ${formatInr(s.startingPrice)}.`,
          confirmLabel: s.status === 'suspended' ? 'Reinstate' : 'Approve',
        });
        if (!ok) return '';
      } else {
        reason = await prompt({
          title: `${action === 'reject' ? 'Reject' : 'Suspend'} “${s.title}”?`,
          body: 'The vendor sees this reason in their Seller Hub.',
          label: 'Reason',
          minLength: 3,
          multiline: true,
          confirmLabel: action === 'reject' ? 'Reject' : 'Suspend',
          danger: true,
        });
        if (!reason) return '';
      }
      setBusyId(s.id);
      try {
        await api(`/admin/services/${s.id}/${action}`, { method: 'POST', body: reason ? { reason } : {} });
        services.mutate((list) => list?.filter((x) => x.id !== s.id) ?? list);
        onDecided();
        return `${s.storeName}: ${SERVICE_KIND_LABEL[s.kind]} ${VERB[action]}`;
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  return (
    <div>
      <FilterChips options={FILTERS} value={status} onChange={setStatus} counts={counts} />
      <ListState loading={services.loading} error={services.error} empty={services.data?.length === 0 ? `No ${status} services.` : null}>
        <ul className="mt-4 space-y-3">
          {services.data?.map((s) => {
            const busy = busyId === s.id;
            const storeBlocked = s.storeStatus !== 'approved';
            return (
              <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      {SERVICE_KIND_LABEL[s.kind]} · {s.title}
                      <StatusBadge status={s.status} />
                      {s.status === 'approved' && !s.isActive && <span className="text-xs text-slate-400">paused by vendor</span>}
                    </p>
                    <p className="text-sm text-slate-600">
                      {s.storeName}, {s.city} · {s.ownerEmail ?? '—'}
                      {storeBlocked && <span className="ml-1 font-semibold text-red-600">(store {s.storeStatus}: approve the store first)</span>}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {s.materials.join(', ')} · max {s.maxXmm}×{s.maxYmm}×{s.maxZmm} mm · from {formatInr(s.startingPrice)} · ~{s.turnaroundHours}h · submitted {formatDateTime(s.createdAt)}
                    </p>
                    {s.description && <p className="mt-1 text-xs text-slate-600">{s.description}</p>}
                    {s.reviewNote && <p className="mt-1 text-xs text-amber-700">Note: {s.reviewNote}</p>}
                  </div>
                  <div className="flex gap-2">
                    {(s.status === 'pending' || s.status === 'suspended') && (
                      <button
                        disabled={busy || storeBlocked}
                        title={storeBlocked ? 'The store must be approved first' : undefined}
                        onClick={() => void decide(s, 'approve')}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {busy ? 'Working…' : s.status === 'suspended' ? 'Reinstate' : 'Approve'}
                      </button>
                    )}
                    {s.status === 'pending' && (
                      <button disabled={busy} onClick={() => void decide(s, 'reject')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
                        Reject
                      </button>
                    )}
                    {s.status === 'approved' && (
                      <button disabled={busy} onClick={() => void decide(s, 'suspend')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
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
