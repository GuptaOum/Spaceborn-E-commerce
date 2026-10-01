'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, fetchAuthedBlob, uploadFile } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatInr } from '@spaceborn/web-core/format';
import type { Category, ProductSubmission, SubmissionStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};
const STATUS_HELP: Record<SubmissionStatus, string> = {
  pending: 'Waiting for an admin. Customers near your store see it only after approval.',
  approved: 'Live in the catalog for customers near your store.',
  rejected: 'Not approved. Fix the details and submit again.',
};
const FILTERS: ('all' | SubmissionStatus)[] = ['all', 'pending', 'approved', 'rejected'];
const MAX_PHOTO_MB = 8;

const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm';
const EMPTY_FORM = { name: '', description: '', categoryId: '', brand: '', mrp: '', price: '', stock: '1' };

function Photo({ id, localUrl }: { id: string; localUrl?: string }) {
  const [src, setSrc] = useState<string | null>(localUrl ?? null);
  useEffect(() => {
    if (localUrl) return;
    let url = '';
    let active = true;
    fetchAuthedBlob(`/vendor/product-submissions/${id}/image`)
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
  }, [id, localUrl]);
  if (!src) return <div className="h-16 w-16 shrink-0 animate-pulse rounded bg-slate-100" />;
  return <img src={src} alt="" className="h-16 w-16 shrink-0 rounded bg-slate-50 object-contain" />;
}

export function ProductsPanel() {
  const { confirm } = useFeedback();
  const submissions = useLoad(() => api<{ submissions: ProductSubmission[] }>('/vendor/product-submissions').then((r) => r.submissions), []);
  const categories = useLoad(() => api<{ categories: Category[] }>('/categories').then((r) => r.categories), []);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const fileInput = useRef<HTMLInputElement>(null);
  // Keep the just-uploaded preview so the new card shows the photo immediately.
  const localPhotos = useRef(new Map<string, string>());

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
    className: input,
    required: true,
  });

  const pickFile = (next: File | null) => {
    setFormError(null);
    if (next && next.size > MAX_PHOTO_MB * 1024 * 1024) {
      setFile(null);
      setFormError(`That photo is ${(next.size / 1024 / 1024).toFixed(1)} MB. Pick one under ${MAX_PHOTO_MB} MB.`);
      return;
    }
    setFile(next);
  };

  const [submit] = useAction(
    async () => {
      if (!file) throw new Error('Add a photo of the product.');
      const mrp = Number(form.mrp);
      const price = Number(form.price);
      if (price > mrp) throw new Error('Your price cannot exceed the MRP.');
      setStep('uploading');
      const uploaded = await uploadFile<{ imageKey: string }>('/vendor/product-images', file);
      setStep('saving');
      const r = await api<{ submission: ProductSubmission }>('/vendor/product-submissions', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          description: form.description.trim(),
          categoryId: form.categoryId,
          brand: form.brand.trim() || undefined,
          mrp,
          price,
          stock: Math.trunc(Number(form.stock)),
          imageKey: uploaded.imageKey,
        },
      });
      if (preview) localPhotos.current.set(r.submission.id, URL.createObjectURL(file));
      submissions.mutate((list) => [r.submission, ...(list ?? [])]);
      setForm(EMPTY_FORM);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setFilter('all');
      return r.submission.name;
    },
    {
      success: (name) => `${name} sent for approval`,
      onError: (err) => {
        setFormError(err.message);
        return true;
      },
    },
  );
  const saving = step !== 'idle';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    await submit();
    setStep('idle');
  };

  const [withdraw, withdrawing] = useAction(
    async (s: ProductSubmission) => {
      const ok = await confirm({ title: `Withdraw “${s.name}”?`, body: 'The admin will no longer see this submission.', confirmLabel: 'Withdraw', danger: true });
      if (!ok) return null;
      submissions.mutate((list) => list?.filter((x) => x.id !== s.id) ?? list);
      try {
        await api(`/vendor/product-submissions/${s.id}`, { method: 'DELETE' });
      } catch (err) {
        submissions.mutate((list) => [s, ...(list ?? [])]);
        throw err;
      }
      return s.name;
    },
    { success: (name) => (name ? `${name} withdrawn` : '') },
  );

  const list = submissions.data ?? [];
  const counts = useMemo(
    () => FILTERS.reduce((acc, f) => ({ ...acc, [f]: f === 'all' ? list.length : list.filter((s) => s.status === f).length }), {} as Record<string, number>),
    [list],
  );
  const visible = filter === 'all' ? list : list.filter((s) => s.status === filter);

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {f} <span className={filter === f ? 'text-slate-300' : 'text-slate-400'}>{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        {submissions.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submissions.error}</p>}
        {submissions.loading && <p className="text-sm text-slate-400">Loading your products…</p>}
        {!submissions.loading && list.length === 0 && <p className="text-sm text-slate-500">No products submitted yet. Use the form to add your first one.</p>}
        {!submissions.loading && list.length > 0 && visible.length === 0 && <p className="text-sm text-slate-500">No {filter} products.</p>}
        {visible.map((s) => (
          <article key={s.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <Photo id={s.id} localUrl={localPhotos.current.get(s.id)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{s.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.status]}`}>{s.status}</span>
              </div>
              <p className="text-xs text-slate-500">
                {s.categoryId} · MRP {formatInr(s.mrp)} · your price {formatInr(s.price)} · stock {s.stock}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{s.description}</p>
              <p className="mt-1 text-xs text-slate-500">{STATUS_HELP[s.status]}</p>
              {s.reviewNote && <p className="mt-1 text-xs text-red-600">Admin note: {s.reviewNote}</p>}
              {s.status === 'pending' && (
                <button onClick={() => void withdraw(s)} disabled={withdrawing} className="mt-2 text-xs font-semibold text-red-700 disabled:opacity-50">
                  Withdraw
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={onSubmit} className="h-fit space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Submit a product</h2>
        <p className="text-xs text-slate-500">Photo, title and description go to an admin. If it matches something already in the catalog, they attach your stock to that item instead of creating a duplicate.</p>
        {formError && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{formError}</p>}
        <label className="block text-xs font-semibold text-slate-600">
          Photo
          <div className="mt-1 flex items-center gap-3">
            {preview ? (
              <img src={preview} alt="Selected product" className="h-20 w-20 rounded-lg border border-slate-200 bg-slate-50 object-contain" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">No photo</div>
            )}
            <div className="min-w-0 flex-1">
              <input
                ref={fileInput}
                required
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                capture="environment"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs"
              />
              <p className="mt-1 text-[10px] font-normal text-slate-400">Large phone photos are resized automatically.</p>
            </div>
          </div>
        </label>
        <label className="block text-xs font-semibold text-slate-600">Title<input minLength={3} maxLength={200} {...field('name')} /></label>
        <label className="block text-xs font-semibold text-slate-600">
          Category
          <select {...field('categoryId')}>
            <option value="">Select…</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600">Brand<input {...field('brand')} required={false} maxLength={80} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-600">MRP ₹<input type="number" min="1" step="0.01" {...field('mrp')} /></label>
          <label className="text-xs font-semibold text-slate-600">Your price ₹<input type="number" min="1" step="0.01" max={form.mrp || undefined} {...field('price')} /></label>
        </div>
        {Number(form.price) > Number(form.mrp) && form.mrp && <p className="text-[11px] text-red-600">Your price must be at or below the MRP.</p>}
        <label className="block text-xs font-semibold text-slate-600">Stock<input type="number" min="0" {...field('stock')} /></label>
        <label className="block text-xs font-semibold text-slate-600">
          Description
          <textarea minLength={10} maxLength={4000} rows={3} {...field('description')} />
        </label>
        <button disabled={saving} className="w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {step === 'uploading' ? 'Uploading photo…' : step === 'saving' ? 'Submitting…' : 'Submit for approval'}
        </button>
      </form>
    </section>
  );
}
