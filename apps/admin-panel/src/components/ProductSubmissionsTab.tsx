'use client';

import { useEffect, useState } from 'react';
import { useDraft } from '@spaceborn/web-core/use-draft';
import { api, fetchAuthedBlob } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatInr } from '@spaceborn/web-core/format';
import type { Category, ProductSubmission, SimilarMatch, SubmissionStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FilterChips, ListState, StatusBadge } from './ui';

const FILTERS: SubmissionStatus[] = ['pending', 'approved', 'rejected'];

function pct(n: number | null) {
  return n == null ? '—' : `${Math.round(n * 100)}%`;
}

function CatalogPhoto({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">No photo</div>;
  return <img src={`/v1/catalog/products/${id}/image`} alt="" className="h-24 w-24 shrink-0 rounded bg-slate-50 object-contain" onError={() => setFailed(true)} />;
}

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

function Review({
  submission,
  categories,
  onDecided,
}: {
  submission: ProductSubmission;
  categories: Category[];
  onDecided: (s: ProductSubmission, verb: string) => void;
}) {
  const { prompt, confirm } = useFeedback();
  const detail = useLoad(() => api<{ submission: ProductSubmission; similar: SimilarMatch[] }>(`/admin/product-submissions/${submission.id}`), [submission.id]);
  const duplicates = detail.data?.similar.filter((m) => m.likelyDuplicate) ?? [];
  const [categoryId, setCategoryId] = useState(submission.categoryId);
  const corrected = categoryId !== submission.categoryId;
  const chosen = categories.find((c) => c.id === categoryId);
  const hiddenPick = chosen?.isVisible === false;
  const [usePhoto, setUsePhoto] = useState(false);

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
      const r = await api<{ submission: { toppedUp?: boolean } }>(`/admin/product-submissions/${submission.id}/approve`, {
        method: 'POST',
        body: {
          ...(match ? { mergeIntoProductId: match.id, usePhoto } : {}),
          ...(corrected ? { categoryId } : {}),
        },
      });
      onDecided(submission, match ? `attached to ${match.name}` : 'approved as a new product');
      const where = corrected && chosen ? ` under ${chosen.name}` : '';
      if (!match) return `${submission.name} is now in the catalog${where}`;
      const photo = usePhoto ? ' Its photo now shows on the website.' : '';
      return r.submission.toppedUp
        ? `${submission.storeName ?? 'The shop'} already sold ${match.name}: added ${submission.stock} units at ${formatInr(submission.price)}.${photo}`
        : `${submission.name}: stock attached to ${match.name}.${photo}`;
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
          <li key={`${match.kind}-${match.id}`} className={`flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs ${match.likelyDuplicate ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">This proposal</p>
                <Photo id={submission.id} />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Suggested match</p>
                {match.kind === 'catalog' ? <CatalogPhoto id={match.id} /> : <Photo id={match.id} />}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">
                {match.name}{' '}
                {match.mpnMatch ? (
                  <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">same part number {match.mpn}</span>
                ) : (
                  match.likelyDuplicate && <span className="text-amber-700">· likely duplicate</span>
                )}
              </p>
              <p className="text-slate-500">
                {match.kind === 'catalog' ? `Catalog ${match.sku ?? ''}` : `Pending submission${match.city ? ` · ${match.city}` : ''}`} · overall {pct(match.score)}
              </p>
              <p className="mt-1 text-slate-600">
                Text {pct(match.textScore)} · Photo {pct(match.imageScore)} · Title {pct(match.nameScore)}
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
      {submission.status === 'pending' && detail.data?.similar.some((m) => m.kind === 'catalog') && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={usePhoto} onChange={(e) => setUsePhoto(e.target.checked)} />
          When attaching, use this proposal’s photo for the catalog item (needs an all-regions admin)
        </label>
      )}
      {submission.status === 'pending' && (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          Category on the website
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-normal text-slate-800"
          >
            {categories
              .filter((c) => c.isVisible !== false || c.id === submission.categoryId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isVisible === false ? ' (hidden)' : ''}
                </option>
              ))}
          </select>
          {corrected && <span className="font-normal text-sky-700">Changed from the vendor’s pick ({submission.categoryName ?? submission.categoryId})</span>}
          {hiddenPick && <span className="font-normal text-amber-700">Hidden in Storefront Studio: pick a visible category to approve as new.</span>}
        </label>
      )}
      {submission.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <button disabled={busy || detail.loading || hiddenPick} onClick={() => void run('new')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
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
  const [status, setStatus] = useDraft<SubmissionStatus>('admin:submissions:status', 'pending');
  const [category, setCategory] = useDraft('admin:submissions:category', '');
  const [openId, setOpenId] = useState<string | null>(null);
  const categories = useLoad(() => api<{ categories: Category[] }>('/categories').then((r) => r.categories), []);
  const query = `status=${status}${category ? `&category=${encodeURIComponent(category)}` : ''}`;
  const submissions = useLoad(() => api<{ submissions: ProductSubmission[] }>(`/admin/product-submissions?${query}`).then((r) => r.submissions), [query]);

  const decided = (s: ProductSubmission) => {
    submissions.mutate((list) => list?.filter((x) => x.id !== s.id) ?? list);
    setOpenId(null);
    onDecided();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips options={FILTERS} value={status} onChange={setStatus} counts={counts} />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800"
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isVisible === false ? ' (hidden)' : ''}
            </option>
          ))}
        </select>
      </div>
      <ListState
        loading={submissions.loading}
        error={submissions.error}
        empty={submissions.data?.length === 0 ? `No ${status} product submissions${category ? ' in this category' : ''}.` : null}
      >
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
                      <span className="font-semibold text-slate-700">{s.categoryName ?? s.categoryId}</span>
                      {s.brand && <> · {s.brand}</>}
                      {s.mpn && <> · part no. <span className="font-mono">{s.mpn}</span></>} · MRP {formatInr(s.mrp)} · price {formatInr(s.price)} · stock {s.stock}
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
                {open && s.status === 'pending' && <Review submission={s} categories={categories.data ?? []} onDecided={decided} />}
              </li>
            );
          })}
        </ul>
      </ListState>
    </div>
  );
}
