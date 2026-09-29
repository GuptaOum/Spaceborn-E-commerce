'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, downloadFile, uploadFile } from '@spaceborn/web-core/api';
import { useAuth } from '@spaceborn/web-core/auth';
import { FAB_STATUS_LABEL, formatBytes, formatDateTime, formatInr, SERVICE_KIND_LABEL } from '@spaceborn/web-core/format';
import type { CheckoutPayment, FabFile, FabJob, FabStatus, ServiceKind, ServiceListing } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { useStore } from '../../context/StoreContext';
import { payWithRazorpay } from '../../lib/razorpay';

const ACCEPT = '.stl,.obj,.3mf,.step,.stp,.iges,.igs,.dxf,.svg,.gcode,.nc,.pdf';
const ACTIVE: FabStatus[] = ['submitted', 'quoted', 'pending_payment', 'in_production', 'ready', 'out_for_delivery'];
const card = 'rounded-3xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-5 shadow-sm';
const input = 'mt-1 w-full rounded-lg border border-[#f9bf8f]/70 bg-white px-3 py-2 text-sm text-[#34222e] outline-none focus:border-[#0c831f]';
const normalizePhone = (v: string) => v.replace(/\D/g, '').slice(-10);

function JobForm({ service, onDone, onCancel }: { service: ServiceListing; onDone: () => void; onCancel: () => void }) {
  const { location, currentUser } = useStore();
  const [files, setFiles] = useState<FabFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    material: service.materials[0] ?? '',
    quantity: '1',
    notes: '',
    fullName: currentUser?.fullName ?? '',
    phone: '',
    line1: '',
    city: location.label === 'Current location' ? '' : location.label,
    pincode: location.pincode,
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list).slice(0, 10 - files.length)) {
        const res = await uploadFile<{ file: FabFile }>('/fabrication/uploads', file);
        setFiles((prev) => [...prev, res.file]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!files.length) return setError('Upload at least one design file.');
    if (!/^[6-9]\d{9}$/.test(normalizePhone(form.phone))) return setError('Enter a valid 10-digit mobile number.');
    setSubmitting(true);
    setError(null);
    try {
      await api('/fabrication/jobs', {
        method: 'POST',
        body: {
          listingId: service.id,
          material: form.material,
          quantity: Number(form.quantity),
          notes: form.notes,
          fileIds: files.map((f) => f.id),
          address: {
            fullName: form.fullName.trim(),
            phone: normalizePhone(form.phone),
            line1: form.line1.trim(),
            city: form.city.trim(),
            pincode: form.pincode,
            latitude: location.latitude,
            longitude: location.longitude,
          },
        },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-3`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-[#0c831f]">{SERVICE_KIND_LABEL[service.kind]}</p>
          <h2 className="font-bold text-[#34222e]">{service.title}</h2>
          <p className="text-xs text-[#7a6274]">{service.storeName}</p>
        </div>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-[#7a6274] underline">
          Back
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <label className="block rounded-2xl border-2 border-dashed border-[#f9bf8f] bg-white p-4 text-center text-sm text-[#7a6274]">
        {uploading ? 'Uploading…' : 'Tap to upload design files (STL, STEP, DXF, 3MF…)'}
        <input type="file" multiple accept={ACCEPT} className="hidden" disabled={uploading} onChange={(e) => onFiles(e.target.files)} />
      </label>
      {files.map((f) => (
        <div key={f.id} className="flex justify-between text-xs text-[#34222e]">
          <span className="truncate">{f.fileName}</span>
          <span className="flex gap-2">
            {formatBytes(f.sizeBytes)}
            <button type="button" onClick={() => setFiles(files.filter((x) => x.id !== f.id))} className="text-[#e2434b]">
              Remove
            </button>
          </span>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-[#7a6274]">
          Material
          <select value={form.material} onChange={set('material')} className={input}>
            {service.materials.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#7a6274]">
          Quantity
          <input type="number" min="1" max="100" required value={form.quantity} onChange={set('quantity')} className={input} />
        </label>
      </div>
      <label className="block text-xs font-semibold text-[#7a6274]">
        Notes for the maker
        <textarea rows={2} maxLength={2000} value={form.notes} onChange={set('notes')} placeholder="Infill, tolerance, finish…" className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-[#7a6274]">
          Name
          <input required minLength={2} value={form.fullName} onChange={set('fullName')} className={input} />
        </label>
        <label className="text-xs font-semibold text-[#7a6274]">
          Mobile
          <input required type="tel" value={form.phone} onChange={set('phone')} className={input} />
        </label>
      </div>
      <label className="block text-xs font-semibold text-[#7a6274]">
        Delivery address
        <input required minLength={3} value={form.line1} onChange={set('line1')} placeholder="Flat, building, street" className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-[#7a6274]">
          City
          <input required value={form.city} onChange={set('city')} className={input} />
        </label>
        <label className="text-xs font-semibold text-[#7a6274]">
          PIN code
          <input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={form.pincode} onChange={set('pincode')} className={input} />
        </label>
      </div>
      <button
        disabled={submitting || uploading}
        className="w-full rounded-xl bg-[#0c831f] py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Get a quote'}
      </button>
      <p className="text-center text-[11px] text-[#7a6274]">You pay only after you accept the maker’s quote.</p>
    </form>
  );
}

function JobCard({ job, onChange }: { job: FabJob; onChange: () => void }) {
  const { currentUser } = useStore();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChange();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const acceptAndPay = () =>
    run(async () => {
      const { payment } = await api<{ job: FabJob; payment: CheckoutPayment }>(`/fabrication/jobs/${job.id}/accept`, { method: 'POST' });
      if (payment.provider === 'razorpay') {
        const result = await payWithRazorpay(payment, `Fabrication job #${job.jobNumber}`, {
          name: job.deliveryAddress.fullName,
          email: currentUser?.email,
          contact: job.deliveryAddress.phone,
        });
        await api(`/fabrication/jobs/${job.id}/verify`, { method: 'POST', body: result });
      } else {
        await api(`/fabrication/jobs/${job.id}/mock-pay`, { method: 'POST' });
      }
    });

  const cancel = () => {
    if (confirm('Cancel this job?')) void run(() => api(`/fabrication/jobs/${job.id}/cancel`, { method: 'POST', body: {} }));
  };

  return (
    <article className={card}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[#34222e]">
            #{job.jobNumber} · {SERVICE_KIND_LABEL[job.kind]}
          </p>
          <p className="text-xs text-[#7a6274]">
            {job.storeName} · {job.quantity} × {job.material} · {formatDateTime(job.createdAt)}
          </p>
        </div>
        <span className="rounded-full bg-[#f2fcf4] px-3 py-1 text-xs font-bold text-[#0c831f]">{FAB_STATUS_LABEL[job.status]}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {job.files.map((f) => (
          <button
            key={f.id}
            onClick={() => downloadFile(`/fabrication/jobs/${job.id}/files/${f.id}`, f.fileName).catch((e: Error) => alert(e.message))}
            className="rounded-lg bg-white px-2 py-1 text-[11px] text-[#34222e] underline"
          >
            {f.fileName}
          </button>
        ))}
      </div>

      {job.quoteAmount != null && (
        <div className="mt-3 rounded-2xl bg-white p-3 text-sm text-[#34222e]">
          <p>
            Quote: <b>{formatInr(job.quoteAmount)}</b>
            {job.readyInHours ? ` · ready in ~${job.readyInHours}h` : ''}
          </p>
          {job.quoteNote && <p className="text-xs text-[#7a6274]">“{job.quoteNote}”</p>}
          {job.grandTotal != null && <p className="text-xs text-[#7a6274]">Total with delivery & fees: {formatInr(job.grandTotal)}</p>}
          {job.status === 'quoted' && job.quoteExpiresAt && (
            <p className="text-xs text-[#7a6274]">Valid until {formatDateTime(job.quoteExpiresAt)}</p>
          )}
        </div>
      )}

      {job.handoverOtp && ['in_production', 'ready', 'out_for_delivery'].includes(job.status) && (
        <p className="mt-3 rounded-xl bg-[#34222e] px-4 py-3 text-sm text-[#fee9d7]">
          Delivery code: <b className="font-mono text-lg tracking-widest">{job.handoverOtp}</b>
        </p>
      )}
      {job.closeReason && <p className="mt-2 text-xs text-[#e2434b]">{job.closeReason}</p>}

      <div className="mt-3 flex gap-2">
        {(job.status === 'quoted' || job.status === 'pending_payment') && (
          <button onClick={acceptAndPay} disabled={busy} className="rounded-xl bg-[#0c831f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            {job.status === 'quoted' ? 'Accept & pay' : 'Complete payment'}
          </button>
        )}
        {['submitted', 'quoted', 'pending_payment'].includes(job.status) && (
          <button onClick={cancel} disabled={busy} className="rounded-xl border border-[#e2434b]/40 px-4 py-2 text-xs font-bold text-[#e2434b] disabled:opacity-50">
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}

export default function FabricationPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { location } = useStore();
  const [kind, setKind] = useState<ServiceKind>('3d_printing');
  const [selected, setSelected] = useState<ServiceListing | null>(null);
  const jobsRef = useRef<HTMLDivElement>(null);

  const services = useLoad(
    () =>
      api<{ services: ServiceListing[] }>(`/services/nearby?lat=${location.latitude}&lng=${location.longitude}&kind=${kind}`).then(
        (r) => r.services,
      ),
    [location.latitude, location.longitude, kind],
  );
  const jobs = useLoad(
    () => (user ? api<{ jobs: FabJob[] }>('/fabrication/jobs').then((r) => r.jobs) : Promise.resolve([] as FabJob[])),
    [user?.uid],
  );

  const hasActive = jobs.data?.some((j) => ACTIVE.includes(j.status));
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void jobs.reload(), 20_000);
    return () => clearInterval(timer);
  }, [hasActive, jobs.reload]);

  const choose = (service: ServiceListing) => {
    if (!user) return router.push('/auth?next=/fabrication');
    setSelected(service);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold text-[#34222e]">Print & machine near you</h1>
        <p className="text-sm text-[#7a6274]">Upload your design, get a quote from a local maker, pay, and get it delivered.</p>
      </div>

      <div className="flex gap-2">
        {(['3d_printing', 'cnc'] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setSelected(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-bold ${kind === k ? 'bg-[#0c831f] text-white' : 'bg-white text-[#34222e]'}`}
          >
            {SERVICE_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {selected ? (
        <JobForm
          service={selected}
          onCancel={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            void jobs.reload();
            jobsRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      ) : (
        <section className="space-y-3">
          {services.loading && !services.data && <p className="text-sm text-[#7a6274]">Finding makers near {location.area}…</p>}
          {services.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{services.error}</p>}
          {services.data?.length === 0 && (
            <div className={`${card} text-center text-sm text-[#7a6274]`}>
              No {SERVICE_KIND_LABEL[kind]} makers deliver to {location.area} yet. Try another location from the header.
            </div>
          )}
          {services.data?.map((s) => (
            <button key={s.id} onClick={() => choose(s)} className={`${card} block w-full text-left hover:border-[#0c831f]`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[#34222e]">{s.title}</p>
                  <p className="text-xs text-[#7a6274]">
                    {s.storeName} · {s.distanceKm} km · ready in ~{s.turnaroundHours}h
                  </p>
                </div>
                <span className="text-sm font-bold text-[#34222e]">from {formatInr(s.startingPrice)}</span>
              </div>
              <p className="mt-2 text-xs text-[#7a6274]">
                {s.materials.join(' · ')} · max {s.maxXmm}×{s.maxYmm}×{s.maxZmm} mm
              </p>
            </button>
          ))}
        </section>
      )}

      <div ref={jobsRef} className="space-y-3">
        <h2 className="text-lg font-bold text-[#34222e]">My print jobs</h2>
        {!loading && !user && <p className="text-sm text-[#7a6274]">Sign in to see your jobs.</p>}
        {jobs.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{jobs.error}</p>}
        {user && jobs.data?.length === 0 && <p className="text-sm text-[#7a6274]">No jobs yet.</p>}
        {jobs.data?.map((job) => <JobCard key={job.id} job={job} onChange={jobs.reload} />)}
      </div>
    </div>
  );
}
