'use client';

import { useState } from 'react';
import { api, downloadFile } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { FAB_STATUS_LABEL, formatDateTime, formatInr, SERVICE_KIND_LABEL } from '@spaceborn/web-core/format';
import type { FabJob, FabStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FilterChips, ListState } from './ui';

const FILTERS = ['active', 'delivered', 'closed'] as const;
type Filter = (typeof FILTERS)[number];
const STATUSES: Record<Filter, string> = {
  active: 'submitted,quoted,pending_payment,in_production,ready,out_for_delivery',
  delivered: 'delivered',
  closed: 'declined,cancelled,expired',
};

const ADMIN_CAN_CANCEL: FabStatus[] = ['submitted', 'quoted', 'pending_payment', 'in_production', 'ready', 'out_for_delivery'];

export function FabJobsTab() {
  const { prompt, toast } = useFeedback();
  const [filter, setFilter] = useState<Filter>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const jobs = useLoad(() => api<{ jobs: FabJob[] }>(`/admin/fab-jobs?status=${STATUSES[filter]}`).then((r) => r.jobs), [filter]);

  const [cancel] = useAction(
    async (job: FabJob) => {
      const reason = await prompt({
        title: `Cancel job #${job.jobNumber}?`,
        body: `${job.storeName} and the customer both see this reason. Paid jobs are refunded.`,
        label: 'Reason',
        minLength: 3,
        multiline: true,
        confirmLabel: 'Cancel job',
        danger: true,
      });
      if (!reason) return '';
      setBusyId(job.id);
      try {
        await api(`/admin/fab-jobs/${job.id}/cancel`, { method: 'POST', body: { reason } });
        jobs.mutate((list) => list?.filter((j) => j.id !== job.id) ?? list);
        return `Job #${job.jobNumber} cancelled`;
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  const download = (job: FabJob, fileId: string, name: string) =>
    downloadFile(`/admin/fab-jobs/${job.id}/files/${fileId}`, name).catch((e: Error) => toast(e.message, 'error'));

  return (
    <div>
      <div className="flex items-center gap-2">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <button onClick={() => void jobs.refresh()} disabled={jobs.refreshing} className="ml-auto text-xs font-semibold text-slate-600 underline disabled:opacity-50">
          {jobs.refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <ListState loading={jobs.loading} error={jobs.error} empty={jobs.data?.length === 0 ? `No ${filter} jobs.` : null}>
        <ul className="mt-4 space-y-3">
          {jobs.data?.map((job) => (
            <li key={job.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    #{job.jobNumber} · {SERVICE_KIND_LABEL[job.kind]} · {FAB_STATUS_LABEL[job.status]}
                  </p>
                  <p className="text-sm text-slate-600">
                    {job.storeName} {job.storeCity ? `(${job.storeCity})` : ''} · {job.quantity} × {job.material} · {formatDateTime(job.createdAt)}
                  </p>
                  <p className="text-xs text-slate-600">
                    Customer: <span className="font-semibold text-slate-800">{job.customerName || 'Customer'}</span>
                    {job.customerEmail && job.customerEmail !== '—' ? ` (${job.customerEmail})` : ''}
                    {job.deliveryAddress?.city ? ` · 📍 ${job.deliveryAddress.city}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    Quote {job.quoteAmount != null ? formatInr(job.quoteAmount) : '—'} · Total {job.grandTotal != null ? formatInr(job.grandTotal) : '—'} · Payment {job.paymentStatus ?? '—'}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {job.files.map((f) => (
                      <button key={f.id} onClick={() => void download(job, f.id, f.fileName)} className="text-xs underline">
                        {f.fileName}
                      </button>
                    ))}
                  </div>
                  {job.closeReason && <p className="mt-1 text-xs text-amber-700">{job.closeReason}</p>}
                </div>
                {ADMIN_CAN_CANCEL.includes(job.status) && (
                  <button disabled={busyId === job.id} onClick={() => void cancel(job)} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
                    {busyId === job.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </ListState>
    </div>
  );
}
