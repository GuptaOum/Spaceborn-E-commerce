'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useFeedback } from '@spaceborn/web-core/feedback';
import { formatInr } from '@spaceborn/web-core/format';
import type { Category } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  brand: string | null;
  mrp: number;
  gstRate: number;
  isActive: boolean;
  storeCount: number;
}

const emptyForm = { sku: '', name: '', categoryId: '', brand: '', mrp: '', gstRate: '18', hsn: '', imageUrl: '', description: '' };

export function ProductsTab() {
  const { toast } = useFeedback();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 300);
    return () => clearTimeout(t);
  }, [typed]);

  const categories = useLoad(() => api<{ categories: Category[] }>('/categories').then((r) => r.categories), []);
  const products = useLoad(
    () => api<{ products: AdminProduct[] }>(`/admin/products?limit=100${search ? `&q=${encodeURIComponent(search)}` : ''}`).then((r) => r.products),
    [search],
  );

  const toggleActive = async (product: AdminProduct) => {
    const wanted = !product.isActive;
    setBusyId(product.id);
    products.mutate((list) => list?.map((p) => (p.id === product.id ? { ...p, isActive: wanted } : p)) ?? list); // optimistic
    try {
      await api(`/admin/products/${product.id}`, { method: 'PATCH', body: { isActive: wanted } });
      toast(wanted ? `${product.name} is active again` : `${product.name} deactivated; stores can no longer sell it`, 'success');
    } catch (err) {
      products.mutate((list) => list?.map((p) => (p.id === product.id ? { ...p, isActive: !wanted } : p)) ?? list);
      toast((err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const r = await api<{ product: Omit<AdminProduct, 'storeCount'> }>('/admin/products', {
        method: 'POST',
        body: {
          sku: form.sku,
          name: form.name,
          categoryId: form.categoryId,
          brand: form.brand || undefined,
          mrp: Number(form.mrp),
          gstRate: Number(form.gstRate),
          hsn: form.hsn || undefined,
          imageUrl: form.imageUrl || undefined,
          description: form.description,
        },
      });
      setForm(emptyForm);
      products.mutate((list) => [{ ...r.product, storeCount: 0 }, ...(list ?? [])]);
      toast(`${r.product.name} added to the catalog`, 'success');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof emptyForm) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
    className: 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm',
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <input
          placeholder="Search by name or SKU"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {products.error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{products.error}</p>}
        {products.loading && <p className="mt-3 text-sm text-slate-400">Loading catalog…</p>}
        {products.data?.length === 0 && <p className="mt-3 text-sm text-slate-500">No products match “{search}”.</p>}
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {products.data?.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className={`text-sm font-semibold ${p.isActive ? '' : 'text-slate-400 line-through'}`}>{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.sku} · {p.categoryId} · MRP {formatInr(p.mrp)} · GST {p.gstRate}% · listed in {p.storeCount} stores
                </p>
              </div>
              <button disabled={busyId === p.id} onClick={() => void toggleActive(p)} className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold disabled:opacity-50">
                {p.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={create} className="h-fit space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Add product</h2>
        {formError && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{formError}</p>}
        <label className="block text-xs font-semibold text-slate-600">SKU<input required {...field('sku')} /></label>
        <label className="block text-xs font-semibold text-slate-600">Name<input required {...field('name')} /></label>
        <label className="block text-xs font-semibold text-slate-600">
          Category
          <select required {...field('categoryId')}>
            <option value="">Select…</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600">Brand<input {...field('brand')} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-slate-600">MRP (₹)<input required type="number" min="1" step="0.01" {...field('mrp')} /></label>
          <label className="block text-xs font-semibold text-slate-600">GST %<input required type="number" min="0" max="28" {...field('gstRate')} /></label>
        </div>
        <label className="block text-xs font-semibold text-slate-600">HSN<input {...field('hsn')} /></label>
        <label className="block text-xs font-semibold text-slate-600">Image URL<input type="url" {...field('imageUrl')} /></label>
        <label className="block text-xs font-semibold text-slate-600">Description<textarea rows={3} {...field('description')} /></label>
        <button disabled={saving} className="w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Add to catalog'}
        </button>
      </form>
    </div>
  );
}
