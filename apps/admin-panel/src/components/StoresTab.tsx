'use client';

import { useEffect, useState } from 'react';
import { useDraft } from '@spaceborn/web-core/use-draft';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime, formatInr } from '@spaceborn/web-core/format';
import { PRODUCT_BADGES, type ProductBadge, type Store, type StoreStatus } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';
import { FilterChips, ListState, StatusBadge } from './ui';

type AdminStore = Store & { ownerEmail: string | null; ownerName: string | null };
type Decision = 'approve' | 'reject' | 'suspend';

interface StoreInventoryItem {
  productId: string;
  sku: string;
  name: string;
  brand: string | null;
  categoryName: string;
  mrp: number;
  badges: ProductBadge[];
  isActive: boolean;
  price: number;
  stock: number;
  unitsSold: number;
  unitsHeld: number;
  isListed: boolean;
  updatedAt: string;
  aboveMrp: boolean;
  holdKind: 'above_mrp' | 'admin' | null;
  holdReason: string | null;
}

interface StoreInventory {
  items: StoreInventoryItem[];
  summary: {
    listed: number; inStock: number; lowStock: number; outOfStock: number; aboveMrp: number; onHold: number; pendingProposals: number;
  };
}

const FILTERS: StoreStatus[] = ['pending', 'approved', 'suspended', 'rejected'];
const VERB: Record<Decision, string> = { approve: 'approved', reject: 'rejected', suspend: 'suspended' };

/** Everything one vendor has on the shelf, with the numbers an admin checks first at the top. */
function StoreInventoryPanel({ storeId }: { storeId: string }) {
  const [query, setQuery] = useDraft('admin:stores:query', '');
  const inv = useLoad(() => api<StoreInventory>(`/admin/stores/${storeId}/inventory`), [storeId]);
  const q = query.trim().toLowerCase();
  const items = (inv.data?.items ?? []).filter(
    (it) => !q || it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q) || it.categoryName.toLowerCase().includes(q),
  );
  const s = inv.data?.summary;
  const { prompt, confirm } = useFeedback();

  const patchItem = (productId: string, patch: Partial<StoreInventoryItem>) =>
    inv.mutate((d) => (d ? { ...d, items: d.items.map((it) => (it.productId === productId ? { ...it, ...patch } : it)) } : d));

  const [act, acting] = useAction(
    async (it: StoreInventoryItem, kind: 'notice' | 'hold' | 'release') => {
      const path = `/admin/stores/${storeId}/inventory/${it.productId}`;
      if (kind === 'notice') {
        const ok = await confirm({
          title: `Ask the shop to lower ${it.name}?`,
          body: `They sell it at ${formatInr(it.price)}, above the MRP of ${formatInr(it.mrp)}. They get a message asking for ${formatInr(it.mrp)} or less.`,
          confirmLabel: 'Send notice',
        });
        if (!ok) return '';
        await api(`${path}/price-notice`, { method: 'POST', body: {} });
        return 'Price notice sent to the shop';
      }
      if (kind === 'hold') {
        const reason = await prompt({
          title: `Take ${it.name} off the website?`,
          body: it.aboveMrp
            ? 'Only this shop’s listing is hidden. It comes back by itself once they price it at or under the MRP.'
            : 'Only this shop’s listing is hidden, and it stays hidden until you lift the hold.',
          label: 'Reason the shop sees',
          minLength: 3,
          multiline: true,
          confirmLabel: 'Take off website',
          danger: true,
        });
        if (!reason) return '';
        const r = await api<{ item: Partial<StoreInventoryItem> }>(`${path}/hold`, { method: 'POST', body: { reason } });
        patchItem(it.productId, r.item);
        return `${it.name} is off the website for this shop`;
      }
      const r = await api<{ item: Partial<StoreInventoryItem> }>(`${path}/hold`, { method: 'DELETE' });
      patchItem(it.productId, r.item);
      return r.item.isListed ? `${it.name} is back on the website` : 'Hold lifted. The shop must lower the price before it shows again.';
    },
    { success: (msg) => msg as string },
  );

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <ListState loading={inv.loading} error={inv.error} empty={inv.data && inv.data.items.length === 0 ? 'This store has not listed anything yet.' : null}>
        {s && inv.data && inv.data.items.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">{s.listed} listed</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 ring-1 ring-emerald-200">{s.inStock} in stock</span>
              {s.lowStock > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-amber-200">{s.lowStock} low (≤5)</span>}
              {s.outOfStock > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-800 ring-1 ring-red-200">{s.outOfStock} out of stock</span>}
              {s.aboveMrp > 0 && <span className="rounded-full bg-red-600 px-2.5 py-1 font-semibold text-white">{s.aboveMrp} above MRP</span>}
              {s.onHold > 0 && <span className="rounded-full bg-slate-800 px-2.5 py-1 font-semibold text-white">{s.onHold} taken off by admin</span>}
              {s.pendingProposals > 0 && <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-800 ring-1 ring-sky-200">{s.pendingProposals} proposals waiting</span>}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name, SKU, category"
                className="ml-auto w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:w-64"
              />
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold">Category</th>
                    <th className="px-3 py-2 text-right font-semibold">Price</th>
                    <th className="px-3 py-2 text-right font-semibold">MRP</th>
                    <th className="px-3 py-2 text-right font-semibold">On shelf</th>
                    <th className="px-3 py-2 text-right font-semibold">Sold</th>
                    <th className="px-3 py-2 text-right font-semibold" title="Already off the shelf for checkouts not paid yet">Awaiting payment</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Updated</th>
                    <th className="px-3 py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.productId} className={it.isListed ? '' : 'text-slate-400'}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-800">{it.name}</p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {it.sku}
                          {it.brand && <> · {it.brand}</>}
                          {it.badges.map((b) => (
                            <span key={b} className="ml-1.5 rounded bg-slate-900 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-white">
                              {PRODUCT_BADGES[b]?.label ?? b}
                            </span>
                          ))}
                        </p>
                      </td>
                      <td className="px-3 py-2">{it.categoryName}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${it.aboveMrp ? 'text-red-700' : ''}`}>
                        {formatInr(it.price)}
                        {it.aboveMrp && <span className="block text-[10px] font-semibold uppercase">above MRP</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">{formatInr(it.mrp)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${it.stock === 0 ? 'text-red-700' : it.stock <= 5 ? 'text-amber-700' : 'text-slate-800'}`}>{it.stock}</td>
                      <td className="px-3 py-2 text-right">{it.unitsSold}</td>
                      <td className="px-3 py-2 text-right">{it.unitsHeld}</td>
                      <td className="px-3 py-2">
                        {!it.isActive ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">Product inactive</span>
                        ) : it.holdKind ? (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-semibold text-white" title={it.holdReason ?? undefined}>
                            Taken off by admin
                          </span>
                        ) : it.isListed ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">Listed</span>
                        ) : (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-600">Hidden by vendor</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatDateTime(it.updatedAt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {it.holdKind ? (
                          <button disabled={acting} onClick={() => void act(it, 'release')} className="rounded border border-slate-300 px-2 py-0.5 font-semibold text-slate-700 disabled:opacity-50">
                            Lift hold
                          </button>
                        ) : it.isListed ? (
                          <span className="flex gap-1">
                            {it.aboveMrp && (
                              <button disabled={acting} onClick={() => void act(it, 'notice')} className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 disabled:opacity-50">
                                Ask to lower
                              </button>
                            )}
                            <button disabled={acting} onClick={() => void act(it, 'hold')} className="rounded border border-red-300 px-2 py-0.5 font-semibold text-red-700 disabled:opacity-50">
                              Take off website
                            </button>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-4 text-center text-slate-500">Nothing matches that filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ListState>
    </div>
  );
}

function StoreThread({ storeId }: { storeId: string }) {
  const [notes, setNotes] = useState<{ id: number; senderRole: string; body: string; createdAt: string }[]>([]);
  const [after, setAfter] = useState(0);
  const [text, setText] = useDraft(`admin:store-thread:${storeId}:text`, '');
  const [error, setError] = useState<string | null>(null);
  const path = `/admin/stores/${storeId}/messages`;

  useEffect(() => {
    let stop = false;
    const load = () => {
      api<{ messages: typeof notes }>(`${path}?after=${after}`)
        .then((res) => {
          if (stop || res.messages.length === 0) return;
          setNotes((prev) => [...prev, ...res.messages]);
          setAfter(res.messages[res.messages.length - 1]!.id);
        })
        .catch((err: Error) => {
          if (!stop) setError(err.message);
        });
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [after, path]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    try {
      const res = await api<{ message: (typeof notes)[number] }>(path, { method: 'POST', body: { body } });
      setNotes((prev) => (prev.some((n) => n.id === res.message.id) ? prev : [...prev, res.message]));
      setAfter(res.message.id);
      setText('');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {notes.length === 0 && <li className="text-xs text-slate-500">No messages with this vendor yet.</li>}
        {notes.map((note) => (
          <li key={note.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${note.senderRole === 'admin' ? 'ml-auto bg-slate-900 text-white' : 'bg-white text-slate-800'}`}>
            <p>{note.body}</p>
            <p className="mt-1 text-[10px] opacity-70">{note.senderRole === 'admin' ? 'You' : 'Vendor'} · {formatDateTime(note.createdAt)}</p>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <form onSubmit={(e) => void send(e)} className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Message this vendor" className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">Send</button>
      </form>
    </div>
  );
}

export function StoresTab({ counts, onDecided }: { counts?: Record<string, number>; onDecided: () => void }) {
  const { prompt, confirm } = useFeedback();
  const [status, setStatus] = useDraft<StoreStatus>('admin:stores:status', 'pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openInventoryId, setOpenInventoryId] = useState<string | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const stores = useLoad(() => api<{ stores: AdminStore[] }>(`/admin/stores?status=${status}`).then((r) => r.stores), [status]);

  const [decide] = useAction(
    async (store: AdminStore, action: Decision) => {
      let reason: string | null = null;
      if (action === 'approve') {
        const ok = await confirm({
          title: store.status === 'suspended' ? `Reinstate ${store.name}?` : `Approve ${store.name}?`,
          body: `${store.ownerEmail ?? 'The owner'} gets vendor access and can list stock for customers within ${store.deliveryRadiusKm} km of ${store.city}.`,
          confirmLabel: store.status === 'suspended' ? 'Reinstate' : 'Approve',
        });
        if (!ok) return '';
      } else {
        reason = await prompt({
          title: `${action === 'reject' ? 'Reject' : 'Suspend'} ${store.name}?`,
          body:
            action === 'suspend'
              ? 'The vendor sees this reason. Their orders and print jobs that have not left the shop are cancelled and refunded now. Anything already out for delivery stays open for you to close under Orders.'
              : 'The vendor sees this reason in their Seller Hub.',
          label: 'Reason',
          minLength: 3,
          multiline: true,
          confirmLabel: action === 'reject' ? 'Reject' : 'Suspend',
          danger: true,
        });
        if (!reason) return '';
      }
      setBusyId(store.id);
      try {
        const r = await api<{ cancelledOrders?: number; cancelledJobs?: number; onTheRoad?: number }>(
          `/admin/stores/${store.id}/${action}`,
          { method: 'POST', body: reason ? { reason } : {} },
        );
        stores.mutate((list) => list?.filter((s) => s.id !== store.id) ?? list); // it now lives under another filter
        onDecided();
        if (action !== 'suspend') return `${store.name} ${VERB[action]}`;
        const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
        const closed = (r.cancelledOrders ?? 0) + (r.cancelledJobs ?? 0);
        return [
          `${store.name} suspended.`,
          closed ? `Cancelled ${plural(r.cancelledOrders ?? 0, 'order')} and ${plural(r.cancelledJobs ?? 0, 'print job')}.` : '',
          r.onTheRoad ? `${r.onTheRoad} still out for delivery: close them under Orders.` : '',
        ]
          .filter(Boolean)
          .join(' ');
      } finally {
        setBusyId(null);
      }
    },
    { success: (msg) => msg as string },
  );

  return (
    <div>
      <FilterChips options={FILTERS} value={status} onChange={setStatus} counts={counts} />
      <ListState loading={stores.loading} error={stores.error} empty={stores.data?.length === 0 ? `No ${status} stores.` : null}>
        <ul className="mt-4 space-y-3">
          {stores.data?.map((store) => {
            const busy = busyId === store.id;
            return (
              <li key={store.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      {store.name}
                      <StatusBadge status={store.status} />
                      {store.status === 'approved' && (
                        <span className={`text-xs font-semibold ${store.isOnline ? 'text-emerald-700' : 'text-slate-400'}`}>{store.isOnline ? '● online' : '○ offline'}</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-600">
                      {store.addressLine}, {store.city} {store.pincode}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Owner: {store.ownerName ?? '—'} · {store.ownerEmail ?? '—'} · {store.phone}
                      {store.gstin && <> · GSTIN {store.gstin}</>}
                    </p>
                    <p className="text-xs text-slate-500">
                      Radius {store.deliveryRadiusKm} km ·{' '}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sky-700 underline hover:text-sky-900"
                        title="Open store location in Google Maps"
                      >
                        📍 {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)} (Maps)
                      </a>{' '}
                      · Applied {formatDateTime(store.createdAt)}
                    </p>
                    {store.reviewNote && <p className="mt-1 text-xs text-amber-700">Note: {store.reviewNote}</p>}
                  </div>
                  <div className="flex gap-2">
                    {store.status !== 'rejected' && (
                      <button
                        onClick={() => setOpenThreadId(openThreadId === store.id ? null : store.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {openThreadId === store.id ? 'Hide messages' : 'Message'}
                      </button>
                    )}
                    {store.status !== 'pending' && store.status !== 'rejected' && (
                      <button
                        onClick={() => setOpenInventoryId(openInventoryId === store.id ? null : store.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {openInventoryId === store.id ? 'Hide inventory' : 'View inventory'}
                      </button>
                    )}
                    {(store.status === 'pending' || store.status === 'suspended') && (
                      <button disabled={busy} onClick={() => void decide(store, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                        {busy ? 'Working…' : store.status === 'suspended' ? 'Reinstate' : 'Approve'}
                      </button>
                    )}
                    {store.status === 'pending' && (
                      <button disabled={busy} onClick={() => void decide(store, 'reject')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
                        Reject
                      </button>
                    )}
                    {store.status === 'approved' && (
                      <button disabled={busy} onClick={() => void decide(store, 'suspend')} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
                {openInventoryId === store.id && <StoreInventoryPanel storeId={store.id} />}
                {openThreadId === store.id && <StoreThread storeId={store.id} />}
              </li>
            );
          })}
        </ul>
      </ListState>
    </div>
  );
}
