'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime } from '@spaceborn/web-core/format';
import type { AdminMember, AdminRegion, AdminScope, AuditEntry } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

const titleCase = (city: string) => city.replace(/\b\w/g, (c) => c.toUpperCase());
const describeRegions = (regions: string[] | null) => (regions === null ? 'All regions' : regions.map(titleCase).join(', '));

export function TeamTab({ me }: { me: AdminScope }) {
  const { toast, confirm, prompt } = useFeedback();
  const team = useLoad(() => api<{ members: AdminMember[] }>('/admin/team').then((r) => r.members), []);
  const regions = useLoad(() => api<{ regions: AdminRegion[] }>('/admin/regions').then((r) => r.regions), []);
  const audit = useLoad(() => api<{ entries: AuditEntry[] }>('/admin/audit?limit=50').then((r) => r.entries), []);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [allRegions, setAllRegions] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [extraCity, setExtraCity] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([team.reload(), audit.reload()]);
  };

  const toggleCity = (city: string) =>
    setPicked((prev) => (prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]));

  const addCity = () => {
    const city = extraCity.trim().toLowerCase();
    if (city.length >= 2 && !picked.includes(city)) setPicked((prev) => [...prev, city]);
    setExtraCity('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const scoped = !isOwner && !allRegions;
    if (scoped && picked.length === 0) {
      setError('Pick at least one city, or give access to all regions.');
      return;
    }
    setBusy('add');
    try {
      await api('/admin/team', {
        method: 'POST',
        body: {
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          regions: scoped ? picked : null,
          isOwner,
        },
      });
      setEmail('');
      setDisplayName('');
      setPicked([]);
      setIsOwner(false);
      setAllRegions(false);
      toast('Admin added. They can sign in right away.', 'success');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const patchMember = async (member: AdminMember, body: Record<string, unknown>, done: string) => {
    setBusy(member.email);
    setError(null);
    try {
      const r = await api<{ member: AdminMember }>(`/admin/team/${encodeURIComponent(member.email)}`, { method: 'PATCH', body });
      team.mutate((list) => list?.map((m) => (m.email === member.email ? r.member : m)) ?? list);
      toast(done, 'success');
      void audit.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const changeRegions = async (member: AdminMember) => {
    const answer = await prompt({
      title: `Cities for ${member.email}`,
      body: 'Comma separated, e.g. Kanpur, Lucknow. Leave empty to allow all regions.',
      label: 'Cities',
      initial: member.regions === null ? '' : member.regions.map(titleCase).join(', '),
    });
    if (answer === null) return;
    const cities = answer.split(',').map((c) => c.trim()).filter(Boolean);
    await patchMember(member, { regions: cities.length ? cities : null }, `${member.email}: ${describeRegions(cities.length ? cities.map((c) => c.toLowerCase()) : null)}`);
  };

  const toggleOwner = async (member: AdminMember) => {
    const makeOwner = !member.isOwner;
    const ok = await confirm({
      title: makeOwner ? `Make ${member.email} an owner?` : `Remove owner rights from ${member.email}?`,
      body: makeOwner ? 'Owners see every region and can add or remove admins.' : 'They keep access to all regions until you restrict them.',
      confirmLabel: makeOwner ? 'Make owner' : 'Remove owner rights',
      danger: !makeOwner,
    });
    if (!ok) return;
    await patchMember(member, makeOwner ? { isOwner: true, regions: null } : { isOwner: false }, makeOwner ? `${member.email} is now an owner` : `${member.email} is no longer an owner`);
  };

  const remove = async (member: AdminMember) => {
    const ok = await confirm({
      title: `Remove ${member.email}?`,
      body: 'Their admin access ends on their very next request.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setBusy(member.email);
    setError(null);
    team.mutate((list) => list?.filter((m) => m.email !== member.email) ?? list);
    try {
      await api(`/admin/team/${encodeURIComponent(member.email)}`, { method: 'DELETE' });
      toast(`${member.email} removed from the admin team`, 'success');
      void audit.refresh();
    } catch (err) {
      team.mutate((list) => [...(list ?? []), member]);
      toast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      {me.isOwner && (
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Add an admin</h2>
          <p className="mt-1 text-xs text-slate-500">
            They sign in with this email (Google or password) on the admin panel. Access starts immediately and can be limited
            to the cities they look after.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block text-xs font-semibold text-slate-600">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="ops.kanpur@company.in"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs font-semibold text-slate-600">Name (optional)</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Kanpur operations"
              />
            </label>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-slate-600">Access</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isOwner} onChange={(e) => setIsOwner(e.target.checked)} />
              Owner: every region, and can manage this team
            </label>
            {!isOwner && (
              <>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={allRegions} onChange={(e) => setAllRegions(e.target.checked)} />
                  All regions (can also edit the master catalog)
                </label>
                {!allRegions && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Cities this admin handles. Only stores, orders, services and product submissions in these cities are visible to them.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(regions.data ?? []).map((r) => (
                        <button
                          type="button"
                          key={r.city}
                          onClick={() => toggleCity(r.city)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            picked.includes(r.city) ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                          }`}
                        >
                          {titleCase(r.city)} <span className="opacity-60">({r.stores})</span>
                        </button>
                      ))}
                      {picked
                        .filter((c) => !(regions.data ?? []).some((r) => r.city === c))
                        .map((c) => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => toggleCity(c)}
                            className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                          >
                            {titleCase(c)} ×
                          </button>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={extraCity}
                        onChange={(e) => setExtraCity(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCity();
                          }
                        }}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                        placeholder="Add a city that has no store yet, e.g. Lucknow"
                      />
                      <button type="button" onClick={addCity} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">
                        Add city
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </fieldset>

          {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={busy === 'add'}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === 'add' ? 'Adding…' : 'Add to team'}
          </button>
        </form>
      )}

      <section>
        <h2 className="font-semibold">Admin team</h2>
        {team.error && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{team.error}</p>}
        {!me.isOwner && error && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <ul className="mt-3 space-y-2">
          {team.data?.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold">
                  {m.displayName ?? m.email}
                  {m.isOwner && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Owner</span>}
                  {m.email === me.email && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                </p>
                {m.displayName && <p className="text-sm text-slate-600">{m.email}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {describeRegions(m.regions)} · Added {formatDateTime(m.createdAt)}
                  {m.addedBy && <> by {m.addedBy}</>} · {m.userId ? `Last active ${formatDateTime(m.lastSeenAt ?? m.createdAt)}` : 'Has not signed in yet'}
                </p>
                {m.note && <p className="text-xs text-slate-500">{m.note}</p>}
              </div>
              {me.isOwner && m.email !== me.email && (
                <div className="flex gap-2">
                  {!m.isOwner && (
                    <button
                      disabled={busy === m.email}
                      onClick={() => changeRegions(m)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                    >
                      Change cities
                    </button>
                  )}
                  <button
                    disabled={busy === m.email}
                    onClick={() => toggleOwner(m)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {m.isOwner ? 'Remove owner' : 'Make owner'}
                  </button>
                  <button
                    disabled={busy === m.email}
                    onClick={() => remove(m)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">Recent admin activity</h2>
        <p className="mt-1 text-xs text-slate-500">Every approval, rejection, suspension, cancellation and team change is recorded here.</p>
        {audit.error && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{audit.error}</p>}
        {audit.data?.length === 0 && <p className="mt-3 text-sm text-slate-500">Nothing yet.</p>}
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {audit.data?.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
              <span>
                <span className="font-mono text-xs text-slate-700">{e.action}</span>
                {e.city && <span className="ml-2 text-xs text-slate-500">{titleCase(e.city)}</span>}
                {typeof e.detail.name === 'string' && <span className="ml-2 text-slate-700">{e.detail.name}</span>}
                {typeof e.detail.reason === 'string' && <span className="ml-2 text-xs text-amber-700">“{e.detail.reason}”</span>}
                {e.targetType === 'admin' && e.targetId && <span className="ml-2 text-slate-700">{e.targetId}</span>}
              </span>
              <span className="text-xs text-slate-500">
                {e.actorEmail ?? 'system'} · {formatDateTime(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
