'use client';

import { useEffect, useState } from 'react';
import { api, downloadFile } from '@spaceborn/web-core/api';
import { FAB_STATUS_LABEL, formatBytes, formatDateTime, formatInr, SERVICE_KIND_LABEL } from '@spaceborn/web-core/format';
import type { FabJob, FabStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const FILTERS = {
  new: 'submitted,quoted,pending_payment',
  production: 'in_production,ready,out_for_delivery',
  done: 'delivered,declined,cancelled,expired',
} as const;

const NEXT: Partial<Record<FabStatus, { to: FabStatus; label: string }>> = {
  in_production: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'out_for_delivery', label: 'Hand to rider' },
  out_for_delivery: { to: 'delivered', label: 'Mark delivered' },
};

function QuoteForm({ job, onDone }: { job: FabJob; onDone: () => void }) {
  const [amount, setAmount] = useState(job.quoteAmount ? String(job.quoteAmount) : '');
  const [hours, setHours] = useState(job.readyInHours ? String(job.readyInHours) : '6');
  const [note, setNote] = useState(job.quoteNote ?? '');
  const [saving, setSaving] = useState(false);

  const send = async () => {
    setSaving(true);
    try {
      await api(`/vendor/fab-jobs/${job.id}/quote`, {
        method: 'POST',
        body: { amount: Number(amount), readyInHours: Number(hours), note: note.trim() || undefined },
      });
      onDone();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

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
      <button disabled={saving || !(Number(amount) > 0)} onClick={send} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
        {job.status === 'quoted' ? 'Update quote' : 'Send quote'}
      </button>
    </div>
  );
}

export function FabJobsPanel() {
  const [filter, setFilter] = useState<keyof typeof FILTERS>('new');
  const [busy, setBusy] = useState<string | null>(null);
  const jobs = useLoad(() => api<{ jobs: FabJob[] }>(`/vendor/fab-jobs?status=${FILTERS[filter]}`).then((r) => r.jobs), [filter]);

  useEffect(() => {
    if (filter === 'done') return;
    const timer = setInterval(() => void jobs.reload(), 20_000);
    return () => clearInterval(timer);
  }, [filter, jobs.reload]);

  const transition = async (job: FabJob, to: FabStatus) => {
    const body: { to: FabStatus; otp?: string; reason?: string } = { to };
    if (to === 'delivered') {
      const otp = prompt(`Ask the customer for the 4-digit delivery code for job #${job.jobNumber}`);
      if (!otp) return;
      body.otp = otp.trim();
    }
    if (to === 'declined' || to === 'cancelled') {
      const reason = prompt(to === 'declined' ? 'Why can’t you take this job?' : 'Why are you cancelling? The customer will be refunded.');
      if (!reason || reason.trim().length < 3) return;
      body.reason = reason.trim();
    }
    setBusy(job.id);
    try {
      await api(`/vendor/fab-jobs/${job.id}/transition`, { method: 'POST', body });
      await jobs.reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            {f}
          </button>
        ))}
        <button onClick={jobs.reload} className="ml-auto text-xs font-semibold text-slate-600 underline">
          Refresh
        </button>
      </div>
      {jobs.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{jobs.error}</p>}
      {jobs.data?.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No jobs here.</p>}

      {jobs.data?.map((job) => {
        const next = NEXT[job.status];
        const addr = job.deliveryAddress;
        return (
          <article key={job.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">
                  #{job.jobNumber} · {SERVICE_KIND_LABEL[job.kind]} · {FAB_STATUS_LABEL[job.status]}
                </p>
                <p className="text-xs text-slate-500">
                  {job.quantity} × {job.material} · {formatDateTime(job.createdAt)} · {job.distanceKm} km ·{' '}
                  {addr.line1 ? `${addr.fullName}, ${addr.line1}, ${addr.phone}` : `${addr.city} ${addr.pincode}`}
                </p>
              </div>
              {job.quoteAmount != null && <p className="font-bold">{formatInr(job.quoteAmount)}</p>}
            </div>
            {job.notes && <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700">“{job.notes}”</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {job.files.map((f) => (
                <button
                  key={f.id}
                  onClick={() => downloadFile(`/vendor/fab-jobs/${job.id}/files/${f.id}`, f.fileName).catch((e: Error) => alert(e.message))}
                  className="rounded border border-slate-200 px-2 py-1 text-xs underline"
                >
                  {f.fileName} ({formatBytes(f.sizeBytes)})
                </button>
              ))}
            </div>
            {job.closeReason && <p className="mt-2 text-xs text-red-600">{job.closeReason}</p>}

            {(job.status === 'submitted' || job.status === 'quoted') && <QuoteForm job={job} onDone={jobs.reload} />}
            {job.status === 'pending_payment' && <p className="mt-2 text-xs text-slate-500">Quote accepted, waiting for the customer to pay.</p>}

            <div className="mt-3 flex gap-2">
              {next && (
                <button
                  disabled={busy === job.id}
                  onClick={() => transition(job, next.to)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {next.label}
                </button>
              )}
              {(job.status === 'submitted' || job.status === 'quoted') && (
                <button disabled={busy === job.id} onClick={() => transition(job, 'declined')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700">
                  Decline
                </button>
              )}
              {job.status === 'in_production' && (
                <button disabled={busy === job.id} onClick={() => transition(job, 'cancelled')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700">
                  Cancel & refund
                </button>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
