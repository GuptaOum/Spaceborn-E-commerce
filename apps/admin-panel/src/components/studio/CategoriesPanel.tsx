'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { CATEGORY_ICONS, type AdminCategory } from '@spaceborn/web-core/storefront';
import { useDraft } from '@spaceborn/web-core/use-draft';
import type { Loaded } from '@spaceborn/web-core/use-load';
import { ListState } from '../ui';
import { input, label, move, OrderButtons } from './shared';

export interface CategoryList {
  categories: AdminCategory[];
  limits: { minVisible: number; max: number };
}

const EMPTY_FORM = { name: '', description: '', keywords: '', icon: 'box' };
type Form = typeof EMPTY_FORM;

const toBody = (f: Form) => ({
  name: f.name.trim(),
  description: f.description.trim(),
  keywords: f.keywords.split(',').map((k) => k.trim()).filter(Boolean),
  icon: f.icon,
});

function CategoryFields({ form, onChange }: { form: Form; onChange: (patch: Partial<Form>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        Name
        <input value={form.name} maxLength={40} required onChange={(e) => onChange({ name: e.target.value })} className={`mt-1 ${input}`} placeholder="e.g. Drones & FPV" />
      </label>
      <label className={label}>
        Icon
        <select value={form.icon} onChange={(e) => onChange({ icon: e.target.value })} className={`mt-1 ${input}`}>
          {CATEGORY_ICONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-2`}>
        Description (shown on the category page)
        <input value={form.description} maxLength={300} onChange={(e) => onChange({ description: e.target.value })} className={`mt-1 ${input}`} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Keywords, comma separated (used by smart sorting; end with * to match a prefix, like stm32*)
        <textarea
          value={form.keywords}
          rows={2}
          onChange={(e) => onChange({ keywords: e.target.value })}
          className={`mt-1 ${input}`}
          placeholder="drone, fpv, flight controller, propeller"
        />
      </label>
    </div>
  );
}

export function CategoriesPanel({ list, onChanged }: { list: Loaded<CategoryList>; onChanged: () => void }) {
  const { confirm } = useFeedback();
  const [adding, setAdding] = useDraft('admin:studio:cat-adding', false);
  const [form, setForm, clearForm] = useDraft<Form>('admin:studio:cat-new', EMPTY_FORM);
  const [editingId, setEditingId] = useDraft<string | null>('admin:studio:cat-editing', null);
  const [editForm, setEditForm, clearEditForm] = useDraft<Form>('admin:studio:cat-edit', EMPTY_FORM);
  const [removing, setRemoving] = useState<{ id: string; moveTo: string } | null>(null);

  const data = list.data;
  const categories = data?.categories ?? [];
  const visible = categories.filter((c) => c.isVisible).length;
  const atMax = !!data && categories.length >= data.limits.max;

  const apply = (next: AdminCategory[]) => list.mutate((d) => (d ? { ...d, categories: next } : d));
  const replace = (cat: AdminCategory) => apply(categories.map((c) => (c.id === cat.id ? cat : c)));

  const [create, creating] = useAction(
    async (e: FormEvent) => {
      e.preventDefault();
      const { category } = await api<{ category: AdminCategory }>('/admin/categories', { method: 'POST', body: toBody(form) });
      apply([...categories, category]);
      clearForm();
      setAdding(false);
      onChanged();
      return `${category.name} added to the storefront`;
    },
    { success: (m) => m as string },
  );

  const [save, saving] = useAction(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!editingId) return '';
      const { category } = await api<{ category: AdminCategory }>(`/admin/categories/${editingId}`, { method: 'PATCH', body: toBody(editForm) });
      replace(category);
      clearEditForm();
      setEditingId(null);
      onChanged();
      return `${category.name} saved`;
    },
    { success: (m) => m as string },
  );

  const [toggle] = useAction(
    async (cat: AdminCategory) => {
      const { category } = await api<{ category: AdminCategory }>(`/admin/categories/${cat.id}`, {
        method: 'PATCH',
        body: { isVisible: !cat.isVisible },
      });
      replace(category);
      onChanged();
      return category.isVisible ? `${category.name} is visible again` : `${category.name} is hidden from customers`;
    },
    { success: (m) => m as string },
  );

  const [reorder] = useAction(async (next: AdminCategory[]) => {
    apply(next);
    await api('/admin/categories/order', { method: 'PUT', body: { ids: next.map((c) => c.id) } });
    onChanged();
  }, { onError: () => { void list.refresh(); } });

  const [remove, removingBusy] = useAction(
    async () => {
      if (!removing) return '';
      const cat = categories.find((c) => c.id === removing.id);
      const target = categories.find((c) => c.id === removing.moveTo);
      if (!cat || !target) return '';
      const ok = await confirm({
        title: `Remove ${cat.name}?`,
        body: `${cat.productCount} product${cat.productCount === 1 ? '' : 's'} will move to ${target.name}. Vendors proposing new products will no longer see ${cat.name}.`,
        confirmLabel: 'Remove category',
        danger: true,
      });
      if (!ok) return '';
      const { moved } = await api<{ moved: number }>(`/admin/categories/${cat.id}?moveTo=${encodeURIComponent(target.id)}`, { method: 'DELETE' });
      setRemoving(null);
      await list.refresh();
      onChanged();
      return `${cat.name} removed; ${moved} product${moved === 1 ? '' : 's'} moved to ${target.name}`;
    },
    { success: (m) => m as string },
  );

  return (
    <ListState loading={list.loading && !data} error={list.error} empty={null}>
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              <b>{categories.length}</b> of {data.limits.max} categories · <b>{visible}</b> visible (customers need at least {data.limits.minVisible})
            </p>
            <button
              type="button"
              disabled={atMax}
              title={atMax ? `The storefront can have at most ${data.limits.max} categories` : undefined}
              onClick={() => setAdding(!adding)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {adding ? 'Close' : 'Add category'}
            </button>
          </div>

          {adding && !atMax && (
            <form onSubmit={(e) => void create(e)} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <CategoryFields form={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
              <div className="flex gap-2">
                <button disabled={creating || form.name.trim().length < 2} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                  {creating ? 'Adding…' : 'Add to storefront'}
                </button>
                <button type="button" onClick={() => { clearForm(); setAdding(false); }} className="px-3 py-1.5 text-sm font-semibold text-slate-600">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {categories.map((cat, index) => {
              const editing = editingId === cat.id;
              const isRemoving = removing?.id === cat.id;
              return (
                <li key={cat.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <OrderButtons index={index} length={categories.length} onMove={(d) => void reorder(move(categories, index, d))} />
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${cat.isVisible ? '' : 'text-slate-400 line-through'}`}>
                        {cat.name} <span className="font-mono text-xs font-normal text-slate-400">{cat.id}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {cat.productCount} product{cat.productCount === 1 ? '' : 's'} · icon {cat.icon} · {cat.keywords.length} keyword{cat.keywords.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button type="button" onClick={() => void toggle(cat)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">
                      {cat.isVisible ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editing) {
                          setEditingId(null);
                          return;
                        }
                        setEditForm({ name: cat.name, description: cat.description, keywords: cat.keywords.join(', '), icon: cat.icon });
                        setEditingId(cat.id);
                      }}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50"
                    >
                      {editing ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoving(isRemoving ? null : { id: cat.id, moveTo: categories.find((c) => c.id !== cat.id)?.id ?? '' })}
                      className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>

                  {isRemoving && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-red-50 p-3">
                      <label className={label}>
                        Move its {cat.productCount} product{cat.productCount === 1 ? '' : 's'} to
                        <select value={removing.moveTo} onChange={(e) => setRemoving({ id: cat.id, moveTo: e.target.value })} className={`mt-1 ${input}`}>
                          {categories.filter((c) => c.id !== cat.id).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button disabled={removingBusy} onClick={() => void remove()} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                        {removingBusy ? 'Removing…' : 'Remove'}
                      </button>
                      <button type="button" onClick={() => setRemoving(null)} className="px-2 py-1.5 text-sm font-semibold text-slate-600">
                        Cancel
                      </button>
                    </div>
                  )}

                  {editing && (
                    <form onSubmit={(e) => void save(e)} className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
                      <CategoryFields form={editForm} onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))} />
                      <button disabled={saving || editForm.name.trim().length < 2} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ListState>
  );
}
