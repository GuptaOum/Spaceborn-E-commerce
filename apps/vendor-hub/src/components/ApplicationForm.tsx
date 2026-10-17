'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useDraft } from '@spaceborn/web-core/use-draft';
import { SERVING_REGIONS, type ServingRegion, type Store } from '@spaceborn/web-core/types';
import { MapPin, Navigation, CheckCircle2, Building2 } from 'lucide-react';

interface Props {
  initial?: Store;
  onSubmitted: () => void;
}

export function ApplicationForm({ initial, onSubmitted }: Props) {
  const draftKey = `vendor:application:${initial?.id ?? 'new'}`;
  const initialRegion = (() => {
    if (initial?.city) {
      const match = SERVING_REGIONS.find((r) => r.city.toLowerCase() === initial.city.toLowerCase());
      return match ? match.id : 'custom';
    }
    return 'kanpur';
  })();
  const [selectedRegionId, setSelectedRegionId, clearRegion] = useDraft<string>(`${draftKey}:region`, initialRegion);

  const [form, setForm, clearForm] = useDraft(`${draftKey}:form`, {
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    gstin: initial?.gstin ?? '',
    addressLine: initial?.addressLine ?? '',
    city: initial?.city ?? 'Kanpur',
    pincode: initial?.pincode ?? '208001',
    latitude: initial ? String(initial.latitude) : '26.4499',
    longitude: initial ? String(initial.longitude) : '80.3319',
    deliveryRadiusKm: initial ? String(initial.deliveryRadiusKm) : '15',
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelectRegion = (region: ServingRegion) => {
    setSelectedRegionId(region.id);
    setForm((f) => ({
      ...f,
      city: region.city,
      pincode: f.pincode.startsWith(region.pincodePrefix) ? f.pincode : region.pincode,
      latitude: String(region.latitude),
      longitude: String(region.longitude),
      deliveryRadiusKm: String(region.defaultRadiusKm),
    }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser. Enter coordinates manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setError(null);
      },
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
      clearRegion();
      clearForm();
      onSubmitted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none transition-colors',
  });

  const activeRegion = SERVING_REGIONS.find((r) => r.id === selectedRegionId);

  return (
    <form onSubmit={submit} className="mx-auto my-8 max-w-xl space-y-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div>
        <h2 className="text-xl font-black text-slate-900">{initial ? 'Re-apply Store Onboarding' : 'Open your Tech Store on Spaceborn'}</h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          List electronics, robotics components, and fabrication services for instant 10–20 minute delivery to local engineers & labs.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-xs sm:text-sm text-red-700 border border-red-200">{error}</p>}

      {/* Serving Region Selection Step */}
      <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
        <label className="block text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <span>Which Region / Hub Are You Serving? *</span>
        </label>
        <p className="text-[11.5px] text-emerald-800 leading-relaxed">
          Crucial: Spaceborn matches customers with stores by region. Customers in this hub will see your inventory & services in real-time.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {SERVING_REGIONS.map((r) => {
            const isSelected = selectedRegionId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectRegion(r)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs font-bold'
                    : 'border-emerald-200/80 bg-white hover:bg-emerald-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">{r.name}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <p className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {r.state}
                </p>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedRegionId('custom')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedRegionId === 'custom'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs font-bold'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black">Other Region</span>
              {selectedRegionId === 'custom' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <p className={`text-[10px] mt-0.5 ${selectedRegionId === 'custom' ? 'text-emerald-100' : 'text-slate-400'}`}>
              Custom Coordinates
            </p>
          </button>
        </div>

        {activeRegion && (
          <div className="mt-2 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-900 flex items-center justify-between flex-wrap gap-1">
            <span><strong>Target Areas:</strong> {activeRegion.keyAreas.slice(0, 4).join(', ')}…</span>
            <span className="font-mono bg-white/80 px-2 py-0.5 rounded text-[10px] font-bold">PIN {activeRegion.pincodePrefix}xxx</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-slate-700">
          Store / Business Name *
          <input required minLength={2} placeholder="e.g. Spaceborn Tech Hub, Robu Kanpur, FabLab Electronics" {...field('name')} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-slate-700">
            Mobile Number *
            <input required inputMode="tel" placeholder="9876543210" {...field('phone')} />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            GSTIN (optional)
            <input placeholder="09AAAAA0000A1Z5" {...field('gstin')} />
          </label>
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Shop / Warehouse Address *
          <input required minLength={5} placeholder="Shop 4, Tech Arcade, Kalyanpur / Koramangala" {...field('addressLine')} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-slate-700">
            City / Serving Hub *
            <input required placeholder="Kanpur / Bengaluru / Chennai" {...field('city')} />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            PIN Code *
            <input required inputMode="numeric" maxLength={6} placeholder="208001" {...field('pincode')} />
          </label>
        </div>

        {/* Location Coordinates & Radius */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-slate-600" />
              <span>Dispatch Coordinates & Range</span>
            </span>
            <button type="button" onClick={useMyLocation} className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1">
              <span>📍 Detect Current GPS</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="block text-[11px] font-semibold text-slate-600">
              Latitude
              <input required type="number" step="any" {...field('latitude')} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">
              Longitude
              <input required type="number" step="any" {...field('longitude')} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">
              Radius (km)
              <input required type="number" min="1" max="15" {...field('deliveryRadiusKm')} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white" />
            </label>
          </div>
          <p className="text-[10.5px] text-slate-500">
            Runners will accept dispatch orders within {form.deliveryRadiusKm || 15} km of these coordinates.
          </p>
        </div>
      </div>

      <button
        disabled={saving}
        className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 py-3 text-sm font-bold text-white transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
      >
        <Building2 className="w-4 h-4" />
        <span>{saving ? 'Submitting Application…' : 'Submit Store for Spaceborn Approval'}</span>
      </button>
    </form>
  );
}
