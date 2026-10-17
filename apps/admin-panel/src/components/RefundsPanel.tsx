'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime, formatInr } from '@spaceborn/web-core/format';
import { useLoad } from '@spaceborn/web-core/use-load';

interface StuckRefund {
  id: number;
  attempts: number;
  lastError: string | null;
  failedAt: string | null;
  nextAttemptAt: string;
  createdAt: string;
  amountPaise: number;
  orderNumber: number | null;
  jobNumber: number | null;
  customerName: string | null;
  storeName: string | null;
  city: string | null;
}

// Refunds the worker has not completed. Failed ones stay here until support retries them or
// records a refund made outside the app; nothing drops out of sight.
export function RefundsPanel() {
  const { prompt } = useFeedback();
  const [busyId, setBusyId] = useState<number | null>(null);
  const refunds = useLoad(() => api<{ refunds: StuckRefund[] }>('/admin/refunds').then((r) => r.refunds), []);
  const label = (r: StuckRefund) => (r.orderNumber ? `order #${r.orderNumber}` : `print job #${r.jobNumber}`);

  const [retry] = useAction(
    async (refund: StuckRefund) => {
      setBusyId(refund.id);
      try {
        await api(`/admin/refunds/${refund.id}/retry`, { method: 'POST', body: {} });
        await refunds.refresh();
        return `Refund for ${label(refund)} queued again`;
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  const [settle] = useAction(
    async (refund: StuckRefund) => {
      const reference = await prompt({
        title: `Record refund for ${label(refund)}`,
        body: `Use this only after ${formatInr(refund.amountPaise / 100)} has reached the customer some other way (bank transfer, or a refund made in the Razorpay dashboard). The app will not try to refund it again.`,
        label: 'Bank UTR or Razorpay refund ID',
        minLength: 3,
        confirmLabel: 'Mark refunded',
      });
      if (!reference) return '';
      setBusyId(refund.id);
      try {
        await api(`/admin/refunds/${refund.id}/settle`, { method: 'POST', body: { reference } });
        refunds.mutate((list) => list?.filter((r) => r.id !== refund.id) ?? list);
        return `Refund for ${label(refund)} recorded`;
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  if (!refunds.data?.length) return null;
  const failed = refunds.data.filter((r) => r.failedAt).length;

  return (
    <section className={`mb-4 rounded-xl border p-3 ${failed ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">
          Refunds not completed · {refunds.data.length}
          {failed > 0 && <span className="ml-2 text-red-700">{failed} stopped retrying</span>}
        </h3>
        <button onClick={() => void refunds.refresh()} disabled={refunds.refreshing} className="text-xs font-semibold text-slate-600 underline disabled:opacity-50">
          {refunds.refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <ul className="mt-2 divide-y divide-slate-200/70 text-xs">
        {refunds.data.map((refund) => (
          <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                {formatInr(refund.amountPaise / 100)} · {label(refund)} · {refund.customerName ?? 'Customer'}
                {refund.storeName && <span className="font-normal text-slate-500"> · {refund.storeName}, {refund.city}</span>}
              </p>
              <p className={refund.failedAt ? 'text-red-700' : 'text-slate-500'}>
                {refund.failedAt
                  ? `Stopped after ${refund.attempts} attempts on ${formatDateTime(refund.failedAt)}`
                  : refund.attempts > 0
                    ? `Retrying, attempt ${refund.attempts}. Next try ${formatDateTime(refund.nextAttemptAt)}`
                    : `Queued ${formatDateTime(refund.createdAt)}`}
                {refund.lastError && <span className="block truncate text-slate-500">{refund.lastError}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={busyId === refund.id}
                onClick={() => void retry(refund)}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Retry now
              </button>
              <button
                disabled={busyId === refund.id}
                onClick={() => void settle(refund)}
                className="rounded border border-emerald-300 bg-white px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              >
                Refunded manually
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
