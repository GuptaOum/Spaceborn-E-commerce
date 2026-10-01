'use client';

import { useEffect, useState } from 'react';
import { api, fetchAuthedBlob } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatInr } from '@spaceborn/web-core/format';
import type { ProductSubmission, SimilarMatch, SubmissionStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FilterChips, ListState, StatusBadge } from './ui';

const FILTERS: SubmissionStatus[] = ['pending', 'approved', 'rejected'];

function Photo({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url = '';
    let active = true;
    fetchAuthedBlob(`/admin/product-submissions/${id}/image`)
      .then((next) => {
        url = next;
        if (active) setSrc(next);
        else URL.revokeObjectURL(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (!src) return <div className="h-24 w-24 shrink-0 animate-pulse rounded bg-slate-100" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" title="Open full size">
      <img src={src} alt="" className="h-24 w-24 shrink-0 rounded bg-slate-50 object-contain" />
    </a>
  );
}

function Review({ submission, onDecided }: { submission: ProductSubmission; onDecided: (s: ProductSubmission, verb: string) => void }) {
  const { prompt, confirm } = useFeedback();
  const detail = useLoad(() => api<{ submission: ProductSubmission; similar: SimilarMatch[] }>(`/admin/product-submissions/${submission.id}`), [submission.id]);
  const duplicates = detail.data?.similar.filter((m) => m.likelyDuplicate) ?? [];

  const [run, busy] = useAction(
    async (kind: 'new' | 'merge' | 'reject', match?: SimilarMatch) => {
      if (kind === 'reject') {
        const reason = await prompt({
          title: `Reject “${submission.name}”?`,
          body: `${submission.storeName ?? 'The vendor'} sees this reason and can fix and resubmit.`,
          label: 'Reason',
          minLength: 3,
          multiline: true,
          confirmLabel: 'Reject',
          danger: true,
        });
        if (!reason) return '';
        await api(`/admin/product-submissions/${submission.id}/reject`, { method: 'POST', body: { reason } });
        onDecided(submission, 'rejected');
        return `${submission.name} rejected`;
      }
      if (kind === 'new' && duplicates.length > 0) {
        const ok = await confirm({
          title: 'Create a new product anyway?',
          body: `${duplicates.length} catalog item${duplicates.length > 1 ? 's look' : ' looks'} like the same thing (${duplicates.map((d) => d.name).join(', ')}). Attaching the stock avoids a duplicate listing.`,
          confirmLabel: 'Create new product',
        });
        if (!ok) return '';
      }
      await api(`/admin/product-submissions/${submission.id}/approve`, { method: 'POST', body: match ? { mergeIntoProductId: match.id } : {} });
      onDecided(submission, match ? `attached to ${match.name}` : 'approved as a new product');
      return match ? `${submission.name}: stock attached to ${match.name}` : `${submission.name} is now in the catalog`;
    },
    { success: (msg) => msg as string },
  );

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {detail.loading && <p className="text-xs text-slate-500">Comparing title, description and photo with the catalog…</p>}
      {detail.error && <p className="text-xs text-red-600">{detail.error}</p>}
      {detail.data?.similar.length === 0 && <p className="text-xs text-emerald-700">No similar catalog item found. Safe to approve as new.</p>}
      <ul className="space-y-2">
        {detail.data?.similar.map((match) => (
          <li key={`${match.kind}-${match.id}`} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${match.likelyDuplicate ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50'}`}>
            <div>
              <p className="font-semibold text-slate-800">
                {match.name} {match.likelyDuplicate && <span className="text-amber-700">· likely duplicate</span>}
              </p>
              <p className="text-slate-500">
                {match.kind === 'catalog' ? `Catalog ${match.sku ?? ''}` : `Pending submission${match.city ? ` · ${match.city}` : ''}`} · match {Math.round(match.score * 100)}%
              </p>
            </div>
            {match.kind === 'catalog' && submission.status === 'pending' && (
              <button disabled={busy} onClick={() => void run('merge', match)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold disabled:opacity-50">
                Attach stock to this
              </button>
            )}
          </li>
        ))}
      </ul>
      {submission.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <button disabled={busy || detail.loading} onClick={() => void run('new')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Working…' : 'Approve as new product'}
          </button>
          <button disabled={busy} onClick={() => void run('reject')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function ProductSubmissionsTab({ counts, onDecided }: { counts?: Record<string, number>; onDecided: () => void }) {
  const [status, setStatus] = useState<SubmissionStatus>('pending');
  const [openId, setOpenId] = useState<string | null>(null);
  const submissions = useLoad(() => api<{ submissions: ProductSubmission[] }>(`/admin/product-submissions?status=${status}`).then((r) => r.submissions), [status]);

  const decided = (s: ProductSubmission) => {
    submissions.mutate((list) => list?.filter((x) => x.id !== s.id) ?? list);
    setOpenId(null);
    onDecided();
  };

  return (
    <div>
      <FilterChips options={FILTERS} value={status} onChange={setStatus} counts={counts} />
      <ListState loading={submissions.loading} error={submissions.error} empty={submissions.data?.length === 0 ? `No ${status} product submissions.` : null}>
        <ul className="mt-4 space-y-3">
          {submissions.data?.map((s) => {
            // Pending items open their review by default, so one click less per decision.
            const open = openId === s.id || (openId === null && s.status === 'pending' && submissions.data?.[0]?.id === s.id);
            return (
              <li key={s.id} className={`rounded-xl border bg-white p-4 ${open ? 'border-slate-400' : 'border-slate-200'}`}>
                <div className="flex gap-3">
                  <Photo id={s.id} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {s.name}
                      <StatusBadge status={s.status} />
                    </p>
                    <p className="text-sm text-slate-600">
                      {s.storeName}, {s.city} · {s.ownerEmail ?? '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {s.categoryId}
                      {s.brand && <> · {s.brand}</>} · MRP {formatInr(s.mrp)} · price {formatInr(s.price)} · stock {s.stock}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                    {s.reviewNote && <p className="mt-1 text-xs text-amber-700">Note: {s.reviewNote}</p>}
                    {s.status === 'pending' && (
                      <button onClick={() => setOpenId(open ? '' : s.id)} className="mt-2 text-xs font-semibold underline">
                        {open ? 'Hide review' : 'Review & cross-check'}
                      </button>
                    )}
                  </div>
                </div>
                {open && s.status === 'pending' && <Review submission={s} onDecided={decided} />}
              </li>
            );
          })}
        </ul>
      </ListState>
    </div>
  );
}
