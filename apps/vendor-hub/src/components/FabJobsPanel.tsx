'use client';

import { useEffect, useState } from 'react';
import { api, downloadFile } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { FAB_STATUS_LABEL, formatBytes, formatDateTime, formatInr, SERVICE_KIND_LABEL } from '@spaceborn/web-core/format';
import type { FabJob, FabStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const FILTERS = {
  new: 'submitted,quoted,pending_payment',
  production: 'in_production,ready,out_for_delivery',
  done: 'delivered,declined,cancelled,expired',
} as const;
type Filter = keyof typeof FILTERS;
const FILTER_LABEL: Record<Filter, string> = { new: 'New & quoted', production: 'In production', done: 'Closed' };

const NEXT: Partial<Record<FabStatus, { to: FabStatus; label: string }>> = {
  in_production: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'out_for_delivery', label: 'Hand to rider' },
  out_for_delivery: { to: 'delivered', label: 'Mark delivered' },
};

const bucketOf = (status: FabStatus): Filter =>
  (Object.keys(FILTERS) as Filter[]).find((f) => FILTERS[f].split(',').includes(status)) ?? 'done';

function QuoteForm({ job, onQuoted }: { job: FabJob; onQuoted: (job: FabJob) => void }) {
  const [amount, setAmount] = useState(job.quoteAmount ? String(job.quoteAmount) : '');
  const [hours, setHours] = useState(job.readyInHours ? String(job.readyInHours) : '6');
  const [note, setNote] = useState(job.quoteNote ?? '');

  const [send, saving] = useAction(
    async () => {
      const r = await api<{ job: FabJob }>(`/vendor/fab-jobs/${job.id}/quote`, {
        method: 'POST',
        body: { amount: Number(amount), readyInHours: Number(hours), note: note.trim() || undefined },
      });
      onQuoted(r.job);
    },
    { success: job.status === 'quoted' ? 'Quote updated; the customer has been told' : 'Quote sent; the customer can now accept and pay' },
  );

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
      <label className="text-xs font-semibold text-slate-600">
        Price for all {job.quantity} (₹)
        <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 block w-28 rounded border border-slate-300 px-2 py-1" />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Ready in (h)
        <input type="number" min="1" max="720" value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1 block w-20 rounded border border-slate-300 px-2 py-1" />
      </label>
      <label className="flex-1 text-xs font-semibold text-slate-600">
        Note
        <input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded border border-slate-300 px-2 py-1" />
      </label>
      <button disabled={saving || !(Number(amount) > 0)} onClick={() => void send()} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
        {saving ? 'Sending…' : job.status === 'quoted' ? 'Update quote' : 'Send quote'}
      </button>
    </div>
  );
}

export function FabJobsPanel() {
  const { prompt, toast } = useFeedback();
  const [filter, setFilter] = useState<Filter>('new');
  const [busyId, setBusyId] = useState<string | null>(null);
  const jobs = useLoad(() => api<{ jobs: FabJob[] }>(`/vendor/fab-jobs?status=${FILTERS[filter]}`).then((r) => r.jobs), [filter]);

  useEffect(() => {
    if (filter === 'done') return;
    const timer = setInterval(() => void jobs.refresh(), 20_000);
    return () => clearInterval(timer);
  }, [filter, jobs.refresh]);

  const replace = (next: FabJob) =>
    jobs.mutate((list) => (list ? (bucketOf(next.status) === filter ? list.map((j) => (j.id === next.id ? next : j)) : list.filter((j) => j.id !== next.id)) : list));

  const [transition] = useAction(
    async (job: FabJob, to: FabStatus) => {
      const body: { to: FabStatus; otp?: string; reason?: string } = { to };
      if (to === 'delivered') {
        const otp = await prompt({
          title: `Deliver job #${job.jobNumber}`,
          body: 'Ask the customer for the 4-digit delivery code.',
          label: 'Delivery code',
          placeholder: '1234',
          minLength: 4,
          confirmLabel: 'Mark delivered',
        });
        if (!otp) return '';
        body.otp = otp;
      }
      if (to === 'declined' || to === 'cancelled') {
        const reason = await prompt({
          title: to === 'declined' ? `Decline job #${job.jobNumber}?` : `Cancel job #${job.jobNumber}?`,
          body: to === 'declined' ? 'Tell the customer why you cannot take it.' : 'The customer is refunded in full and sees your reason.',
          label: 'Reason',
          minLength: 3,
          multiline: true,
          confirmLabel: to === 'declined' ? 'Decline' : 'Cancel & refund',
          danger: true,
        });
        if (!reason) return '';
        body.reason = reason;
      }
      setBusyId(job.id);
      try {
        const r = await api<{ job: FabJob }>(`/vendor/fab-jobs/${job.id}/transition`, { method: 'POST', body });
        replace(r.job);
        return `#${job.jobNumber} ${FAB_STATUS_LABEL[r.job.status].toLowerCase()}`;
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  const download = (jobId: string, fileId: string, name: string) =>
    downloadFile(`/vendor/fab-jobs/${jobId}/files/${fileId}`, name).catch((e: Error) => toast(e.message, 'error'));

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            {FILTER_LABEL[f]}
            {f === filter && jobs.data && <span className="ml-1 text-slate-300">{jobs.data.length}</span>}
          </button>
        ))}
        <button onClick={() => void jobs.refresh()} disabled={jobs.refreshing} className="ml-auto text-xs font-semibold text-slate-600 underline disabled:opacity-50">
          {jobs.refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {jobs.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{jobs.error}</p>}
      {jobs.loading && <p className="p-6 text-center text-sm text-slate-400">Loading jobs…</p>}
      {jobs.data?.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No jobs here.</p>}

      {jobs.data?.map((job) => {
        const next = NEXT[job.status];
        const addr = job.deliveryAddress;
        const busy = busyId === job.id;
        return (
          <article key={job.id} className={`rounded-xl border bg-white p-4 ${job.status === 'submitted' ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">
                  #{job.jobNumber} · {SERVICE_KIND_LABEL[job.kind]} · {FAB_STATUS_LABEL[job.status]}
                </p>
                <p className="text-xs text-slate-500">
                  {job.quantity} × {job.material} · {formatDateTime(job.createdAt)} · {job.distanceKm} km away
                </p>
              </div>
              {job.quoteAmount != null && <p className="font-bold">{formatInr(job.quoteAmount)}</p>}
            </div>

            {/* Customer identification & delivery details */}
            <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">Customer: </span>
                  <span className="font-semibold text-slate-800">{job.customerName || 'Customer'}</span>
                  {job.customerEmail && job.customerEmail !== '—' && (
                    <span className="ml-2 text-slate-500 font-mono">({job.customerEmail})</span>
                  )}
                  {job.customerPhone && job.customerPhone !== '—' && (
                    <span className="ml-2 text-slate-600">📞 {job.customerPhone}</span>
                  )}
                </div>
                <div className="text-slate-500">
                  📍 {addr.city || 'Local Area'} {addr.pincode ? `(${addr.pincode})` : ''}
                </div>
              </div>
              {addr.line1 && (
                <p className="mt-1 text-slate-500">
                  Deliver to: {addr.fullName ? `${addr.fullName}, ` : ''}{addr.line1}, {addr.city} - {addr.pincode}
                </p>
              )}
            </div>

            {job.notes && <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700">“{job.notes}”</p>}

            {/* Submitted design files */}
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Submitted CAD/Design Files ({job.files.length}):</p>
              <div className="flex flex-wrap gap-2">
                {job.files.map((f) => {
                  const ext = f.fileName.split('.').pop()?.toUpperCase() || 'FILE';
                  return (
                    <button
                      key={f.id}
                      onClick={() => void download(job.id, f.id, f.fileName)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors shadow-sm"
                      title={`Download ${f.fileName}`}
                    >
                      <span className="rounded bg-indigo-200 px-1 py-0.5 text-[10px] font-bold text-indigo-900">
                        {ext}
                      </span>
                      <span>⬇️ Download</span>
                      <span className="font-mono">{f.fileName}</span>
                      <span className="text-indigo-400 font-normal">({formatBytes(f.sizeBytes)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {job.closeReason && <p className="mt-2 text-xs text-red-600">{job.closeReason}</p>}

            {(job.status === 'submitted' || job.status === 'quoted') && <QuoteForm key={job.status} job={job} onQuoted={replace} />}
            {job.status === 'pending_payment' && <p className="mt-2 text-xs text-slate-500">Quote accepted, waiting for the customer to pay.</p>}

            {(next || job.status === 'submitted' || job.status === 'quoted' || job.status === 'in_production') && (
              <div className="mt-3 flex gap-2">
                {next && (
                  <button disabled={busy} onClick={() => void transition(job, next.to)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                    {busy ? 'Working…' : next.label}
                  </button>
                )}
                {(job.status === 'submitted' || job.status === 'quoted') && (
                  <button disabled={busy} onClick={() => void transition(job, 'declined')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
                    Decline
                  </button>
                )}
                {job.status === 'in_production' && (
                  <button disabled={busy} onClick={() => void transition(job, 'cancelled')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
                    Cancel & refund
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
