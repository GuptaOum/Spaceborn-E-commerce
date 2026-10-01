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
  const [editing, setEditing] = useState<ProductSubmission | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
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

  const onEdit = (s: ProductSubmission) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description,
      categoryId: s.categoryId,
      brand: s.brand ?? '',
      mrp: String(s.mrp),
      price: String(s.price),
      stock: String(s.stock),
    });
    setFile(null);
    setFormError(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setFormError(null);
  };

  const [submit] = useAction(
    async () => {
      if (!file && !editing) throw new Error('Add a photo of the product.');
      const mrp = Number(form.mrp);
      const price = Number(form.price);
      if (price > mrp) throw new Error('Your price cannot exceed the MRP.');
      let imageKey: string | undefined = undefined;
      if (file) {
        setStep('uploading');
        const uploaded = await uploadFile<{ imageKey: string }>('/vendor/product-images', file);
        imageKey = uploaded.imageKey;
      }
      setStep('saving');
      if (editing) {
        const r = await api<{ submission: ProductSubmission }>(`/vendor/product-submissions/${editing.id}`, {
          method: 'PATCH',
          body: {
            name: form.name.trim(),
            description: form.description.trim(),
            categoryId: form.categoryId,
            brand: form.brand.trim() || undefined,
            mrp,
            price,
            stock: Math.trunc(Number(form.stock)),
            ...(imageKey ? { imageKey } : {}),
          },
        });
        if (file && preview) localPhotos.current.set(r.submission.id, URL.createObjectURL(file));
        submissions.mutate((list) => list?.map((x) => (x.id === editing.id ? r.submission : x)) ?? [r.submission]);
        setEditing(null);
        setForm(EMPTY_FORM);
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
        setFilter('all');
        return `${r.submission.name} updated and resubmitted`;
      } else {
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
            imageKey: imageKey!,
          },
        });
        if (preview && file) localPhotos.current.set(r.submission.id, URL.createObjectURL(file));
        submissions.mutate((list) => [r.submission, ...(list ?? [])]);
        setForm(EMPTY_FORM);
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
        setFilter('all');
        return r.submission.name;
      }
    },
    {
      success: (result: unknown) => (String(result).includes('resubmitted') ? String(result) : `${result} sent for approval`),
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.status === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    className="rounded bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    ✏️ Edit & resubmit
                  </button>
                )}
                {s.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(s)}
                      className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      ✏️ Edit
                    </button>
                    <button onClick={() => void withdraw(s)} disabled={withdrawing} className="text-xs font-semibold text-red-700 disabled:opacity-50">
                      Withdraw
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="h-fit space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{editing ? 'Edit proposal' : 'Submit a product'}</h2>
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          )}
        </div>
        {editing ? (
          <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
            <p className="font-semibold">Revising: {editing.name}</p>
            {editing.reviewNote && <p className="mt-0.5 text-amber-800">Admin feedback: {editing.reviewNote}</p>}
            <p className="mt-1 text-[11px] text-amber-700">Update any details below. You can keep the existing photo or upload a new one.</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Photo, title and description go to an admin. If it matches something already in the catalog, they attach your stock to that item instead of creating a duplicate.</p>
        )}
        {formError && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{formError}</p>}
        <label className="block text-xs font-semibold text-slate-600">
          Photo {editing && <span className="font-normal text-slate-400">(optional if keeping current)</span>}
          <div className="mt-1 flex items-center gap-3">
            {preview ? (
              <img src={preview} alt="Selected product" className="h-20 w-20 rounded-lg border border-slate-200 bg-slate-50 object-contain" />
            ) : editing?.hasImage ? (
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-500 text-center p-1">
                <span>Existing photo</span>
                <span className="text-[9px] text-slate-400">Kept by default</span>
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">No photo</div>
            )}
            <div className="min-w-0 flex-1">
              <input
                ref={fileInput}
                required={!editing}
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
          {step === 'uploading' ? 'Uploading photo…' : step === 'saving' ? 'Submitting…' : editing ? 'Update & resubmit for approval' : 'Submit for approval'}
        </button>
      </form>
    </section>
  );
}
