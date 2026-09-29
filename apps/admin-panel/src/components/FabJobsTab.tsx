'use client';

import { useState } from 'react';
import { api, downloadFile } from '@spaceborn/web-core/api';
import { FAB_STATUS_LABEL, formatDateTime, formatInr, SERVICE_KIND_LABEL } from '@spaceborn/web-core/format';
import type { FabJob, FabStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const FILTERS = {
  active: 'submitted,quoted,pending_payment,in_production,ready,out_for_delivery',
  delivered: 'delivered',
  closed: 'declined,cancelled,expired',
} as const;

const ADMIN_CAN_CANCEL: FabStatus[] = ['submitted', 'quoted', 'pending_payment', 'in_production', 'ready', 'out_for_delivery'];

export function FabJobsTab() {
  const [filter, setFilter] = useState<keyof typeof FILTERS>('active');
  const { data, error, loading, reload } = useLoad(
    () => api<{ jobs: FabJob[] }>(`/admin/fab-jobs?status=${FILTERS[filter]}`).then((r) => r.jobs),
    [filter],
  );

  const cancel = async (job: FabJob) => {
    const reason = window.prompt(`Reason to cancel job #${job.jobNumber}? Paid jobs are refunded.`);
    if (!reason || reason.trim().length < 3) return;
    try {
      await api(`/admin/fab-jobs/${job.id}/cancel`, { method: 'POST', body: { reason: reason.trim() } });
      await reload();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {data?.length === 0 && <p className="mt-4 text-sm text-slate-500">No jobs.</p>}

      <ul className="mt-4 space-y-3">
        {data?.map((job) => (
          <li key={job.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  #{job.jobNumber} · {SERVICE_KIND_LABEL[job.kind]} · {FAB_STATUS_LABEL[job.status]}
                </p>
                <p className="text-sm text-slate-600">
                  {job.storeName} · {job.quantity} × {job.material} · {formatDateTime(job.createdAt)}
                </p>
                <p className="text-xs text-slate-500">
                  Quote {job.quoteAmount != null ? formatInr(job.quoteAmount) : '—'} · Total{' '}
                  {job.grandTotal != null ? formatInr(job.grandTotal) : '—'} · Payment {job.paymentStatus ?? '—'}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {job.files.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => downloadFile(`/admin/fab-jobs/${job.id}/files/${f.id}`, f.fileName).catch((e: Error) => alert(e.message))}
                      className="text-xs underline"
                    >
                      {f.fileName}
                    </button>
                  ))}
                </div>
                {job.closeReason && <p className="mt-1 text-xs text-amber-700">{job.closeReason}</p>}
              </div>
              {ADMIN_CAN_CANCEL.includes(job.status) && (
                <button onClick={() => cancel(job)} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700">
                  Cancel
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
