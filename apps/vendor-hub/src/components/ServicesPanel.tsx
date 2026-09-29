'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@spaceborn/web-core/api';
import { formatInr, SERVICE_KIND_LABEL } from '@spaceborn/web-core/format';
import type { ServiceKind, ServiceListing } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const STATUS_STYLE: Record<ServiceListing['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-slate-200 text-slate-700',
};

const DEFAULTS: Record<ServiceKind, { title: string; materials: string; size: [number, number, number] }> = {
  '3d_printing': { title: 'FDM 3D printing', materials: 'PLA, PETG, ABS, TPU', size: [220, 220, 250] },
  cnc: { title: 'CNC routing & milling', materials: 'Aluminium 6061, Acrylic, MDF, Delrin', size: [600, 400, 80] },
};

function ListingForm({ kind, existing, onSaved }: { kind: ServiceKind; existing?: ServiceListing; onSaved: () => void }) {
  const d = DEFAULTS[kind];
  const [form, setForm] = useState({
    title: existing?.title ?? d.title,
    description: existing?.description ?? '',
    materials: existing?.materials.join(', ') ?? d.materials,
    maxXmm: String(existing?.maxXmm ?? d.size[0]),
    maxYmm: String(existing?.maxYmm ?? d.size[1]),
    maxZmm: String(existing?.maxZmm ?? d.size[2]),
    startingPrice: String(existing?.startingPrice ?? 99),
    turnaroundHours: String(existing?.turnaroundHours ?? 6),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const field = (k: keyof typeof form, props: Record<string, unknown> = {}) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
    className: 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm',
    required: true,
    ...props,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (existing?.status === 'approved' && !confirm('Changing an approved service sends it back for admin review. Continue?')) return;
    setSaving(true);
    setError(null);
    try {
      await api('/vendor/services', {
        method: 'POST',
        body: {
          kind,
          title: form.title,
          description: form.description,
          materials: form.materials.split(',').map((m) => m.trim()).filter(Boolean),
          maxXmm: Number(form.maxXmm),
          maxYmm: Number(form.maxYmm),
          maxZmm: Number(form.maxZmm),
          startingPrice: Number(form.startingPrice),
          turnaroundHours: Number(form.turnaroundHours),
        },
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <label className="block text-xs font-semibold text-slate-600">Title<input {...field('title', { minLength: 3 })} /></label>
      <label className="block text-xs font-semibold text-slate-600">
        Materials (comma separated)<input {...field('materials')} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs font-semibold text-slate-600">Max X mm<input type="number" {...field('maxXmm')} /></label>
        <label className="text-xs font-semibold text-slate-600">Max Y mm<input type="number" {...field('maxYmm')} /></label>
        <label className="text-xs font-semibold text-slate-600">Max Z mm<input type="number" {...field('maxZmm')} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-slate-600">Starting price ₹<input type="number" min="0" {...field('startingPrice')} /></label>
        <label className="text-xs font-semibold text-slate-600">Typical turnaround (hours)<input type="number" min="1" max="720" {...field('turnaroundHours')} /></label>
      </div>
      <label className="block text-xs font-semibold text-slate-600">
        Description<textarea rows={2} {...field('description', { required: false })} />
      </label>
      <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? 'Submitting…' : existing ? 'Update & resubmit' : 'Submit for approval'}
      </button>
    </form>
  );
}

export function ServicesPanel() {
  const services = useLoad(() => api<{ services: ServiceListing[] }>('/vendor/services').then((r) => r.services), []);
  const [editing, setEditing] = useState<ServiceKind | null>(null);

  const toggle = async (s: ServiceListing) => {
    try {
      await api(`/vendor/services/${s.id}`, { method: 'PATCH', body: { isActive: !s.isActive } });
      await services.reload();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {services.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{services.error}</p>}
      {(['3d_printing', 'cnc'] as const).map((kind) => {
        const s = services.data?.find((x) => x.kind === kind);
        return (
          <div key={kind} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">{SERVICE_KIND_LABEL[kind]}</p>
                {s ? (
                  <p className="text-xs text-slate-500">
                    {s.title} · from {formatInr(s.startingPrice)} · {s.materials.join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">Not offered yet</p>
                )}
              </div>
              {s && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.status]}`}>{s.status}</span>}
            </div>
            {s?.reviewNote && <p className="mt-2 text-xs text-red-600">Admin note: {s.reviewNote}</p>}
            {s?.status === 'pending' && <p className="mt-2 text-xs text-slate-500">Customers will see it after an admin approves it.</p>}
            <div className="mt-3 flex gap-2">
              {s?.status !== 'suspended' && (
                <button onClick={() => setEditing(editing === kind ? null : kind)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">
                  {editing === kind ? 'Close' : s ? 'Edit' : 'Offer this service'}
                </button>
              )}
              {s?.status === 'approved' && (
                <button onClick={() => toggle(s)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">
                  {s.isActive ? 'Pause taking jobs' : 'Resume taking jobs'}
                </button>
              )}
            </div>
            {editing === kind && (
              <ListingForm
                kind={kind}
                existing={s}
                onSaved={() => {
                  setEditing(null);
                  void services.reload();
                }}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}
