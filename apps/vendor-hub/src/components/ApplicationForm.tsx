'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@spaceborn/web-core/api';
import type { Store } from '@spaceborn/web-core/types';

interface Props {
  initial?: Store;
  onSubmitted: () => void;
}

export function ApplicationForm({ initial, onSubmitted }: Props) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    gstin: initial?.gstin ?? '',
    addressLine: initial?.addressLine ?? '',
    city: initial?.city ?? '',
    pincode: initial?.pincode ?? '',
    latitude: initial ? String(initial.latitude) : '',
    longitude: initial ? String(initial.longitude) : '',
    deliveryRadiusKm: initial ? String(initial.deliveryRadiusKm) : '5',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })),
      () => setError('Location permission denied. Enter the coordinates of your store manually.'),
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/vendor/applications', {
        method: 'POST',
        body: {
          name: form.name,
          phone: form.phone.replace(/\s/g, ''),
          gstin: form.gstin || undefined,
          addressLine: form.addressLine,
          city: form.city,
          pincode: form.pincode,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          deliveryRadiusKm: Number(form.deliveryRadiusKm),
        },
      });
      onSubmitted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
    className: 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm',
  });

  return (
    <form onSubmit={submit} className="mx-auto my-8 max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold">{initial ? 'Re-apply' : 'Open your store on Spaceborn'}</h2>
      <p className="text-sm text-slate-500">Customers within your delivery radius will see your stock and order for 10–20 minute delivery.</p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <label className="block text-xs font-semibold text-slate-600">Store name<input required minLength={2} {...field('name')} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-600">Mobile<input required inputMode="tel" placeholder="9876543210" {...field('phone')} /></label>
        <label className="block text-xs font-semibold text-slate-600">GSTIN (optional)<input {...field('gstin')} /></label>
      </div>
      <label className="block text-xs font-semibold text-slate-600">Shop address<input required minLength={5} {...field('addressLine')} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-600">City<input required {...field('city')} /></label>
        <label className="block text-xs font-semibold text-slate-600">PIN code<input required inputMode="numeric" maxLength={6} {...field('pincode')} /></label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-xs font-semibold text-slate-600">Latitude<input required type="number" step="any" {...field('latitude')} /></label>
        <label className="block text-xs font-semibold text-slate-600">Longitude<input required type="number" step="any" {...field('longitude')} /></label>
        <label className="block text-xs font-semibold text-slate-600">Radius (km)<input required type="number" min="1" max="15" {...field('deliveryRadiusKm')} /></label>
      </div>
      <button type="button" onClick={useMyLocation} className="text-xs font-semibold text-slate-700 underline">
        Use my current location (stand inside the shop)
      </button>
      <button disabled={saving} className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? 'Submitting…' : 'Submit for approval'}
      </button>
    </form>
  );
}
