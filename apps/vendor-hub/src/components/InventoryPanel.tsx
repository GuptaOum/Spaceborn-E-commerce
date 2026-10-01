'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatInr } from '@spaceborn/web-core/format';
import { useLoad } from '@spaceborn/web-core/use-load';

interface InventoryItem {
  productId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  mrp: number;
  price: number;
  stock: number;
  isListed: boolean;
}

type CatalogEntry = Pick<InventoryItem, 'productId' | 'sku' | 'name' | 'imageUrl' | 'mrp'>;
type Saved = Pick<InventoryItem, 'productId' | 'price' | 'stock' | 'isListed'>;

const LOW_STOCK = 5;
const VIEWS = { all: 'All', low: 'Low stock', hidden: 'Hidden' } as const;
type View = keyof typeof VIEWS;

const save = (productId: string, body: Record<string, unknown>) =>
  api<{ item: Saved }>(`/vendor/inventory/${productId}`, { method: 'PUT', body }).then((r) => r.item);

function Row({ item, onSaved }: { item: InventoryItem; onSaved: (saved: Saved) => void }) {
  const [price, setPrice] = useState(String(item.price));
  const [delta, setDelta] = useState('');
  useEffect(() => setPrice(String(item.price)), [item.price]);

  const [update, busy] = useAction(
    async (body: Record<string, unknown>, done: string) => {
      const saved = await save(item.productId, body);
      onSaved(saved);
      setDelta('');
      return done;
    },
    { success: (msg) => msg as string },
  );

  const priceNumber = Number(price);
  const priceChanged = priceNumber !== item.price;
  const priceValid = priceNumber > 0 && priceNumber <= item.mrp;
  const deltaNumber = Math.trunc(Number(delta));
  const dirty = priceChanged || deltaNumber !== 0;
  const nextStock = Math.max(0, item.stock + deltaNumber);

  const commit = () => {
    if (priceChanged && !priceValid) return;
    void update(
      { ...(priceChanged ? { price: priceNumber } : {}), ...(deltaNumber ? { stockDelta: deltaNumber } : {}) },
      `${item.name}: ${[priceChanged && `price ${formatInr(priceNumber)}`, deltaNumber && `stock ${nextStock}`].filter(Boolean).join(', ')}`,
    );
  };

  const nudge = (n: number) => setDelta(String(deltaNumber + n));

  return (
    <tr className={`border-t border-slate-100 ${item.isListed ? '' : 'bg-slate-50/70 text-slate-500'}`}>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900">{item.name}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.isListed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
            {item.isListed ? 'Live' : 'Hidden'}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {item.sku} · MRP {formatInr(item.mrp)}
        </p>
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min="1"
          max={item.mrp}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          aria-label={`Price for ${item.name}`}
          className={`w-24 rounded border px-2 py-1 ${priceChanged ? (priceValid ? 'border-amber-400 bg-amber-50' : 'border-red-400 bg-red-50') : 'border-slate-300'}`}
        />
        {priceChanged && !priceValid && <p className="mt-0.5 text-[10px] text-red-600">1 – {item.mrp}</p>}
      </td>
      <td className="py-2 pr-2">
        <span className={`font-bold ${item.stock === 0 ? 'text-red-600' : item.stock <= LOW_STOCK ? 'text-amber-600' : 'text-slate-900'}`}>{item.stock}</span>
        {deltaNumber !== 0 && <span className="ml-1 text-xs text-amber-700">→ {nextStock}</span>}
      </td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => nudge(-1)} disabled={busy || nextStock === 0} className="h-7 w-7 rounded border border-slate-300 text-sm font-bold disabled:opacity-40" aria-label="One less">
            −
          </button>
          <input
            type="number"
            placeholder="±"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            aria-label={`Stock adjustment for ${item.name}`}
            className="w-16 rounded border border-slate-300 px-2 py-1 text-center"
          />
          <button type="button" onClick={() => nudge(1)} disabled={busy} className="h-7 w-7 rounded border border-slate-300 text-sm font-bold disabled:opacity-40" aria-label="One more">
            +
          </button>
        </div>
      </td>
      <td className="space-x-2 py-2 whitespace-nowrap">
        <button
          disabled={busy || !dirty || (priceChanged && !priceValid)}
          onClick={commit}
          className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          disabled={busy}
          onClick={() => void update({ isListed: !item.isListed }, item.isListed ? `${item.name} hidden from customers` : `${item.name} is live`)}
          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold disabled:opacity-40"
        >
          {item.isListed ? 'Hide' : 'Show'}
        </button>
      </td>
    </tr>
  );
}

function AddFromCatalog({ owned, onAdded }: { owned: Set<string>; onAdded: (item: InventoryItem) => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const catalog = useLoad(
    () => api<{ products: CatalogEntry[] }>(`/vendor/catalog?limit=20${query ? `&q=${encodeURIComponent(query)}` : ''}`).then((r) => r.products),
    [query],
  );

  // Debounced live search instead of a separate Search button.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const [add, adding] = useAction(
    async (product: CatalogEntry, priceValue: number, stockValue: number) => {
      const saved = await save(product.productId, { price: priceValue, stock: stockValue });
      onAdded({ ...product, ...saved });
      setPicked(null);
      return product.name;
    },
    { success: (name) => `${name} added to your inventory` },
  );

  const pick = (p: CatalogEntry) => {
    setPicked(p);
    setPrice(String(p.mrp));
    setStock('10');
  };

  const candidates = catalog.data?.filter((p) => !owned.has(p.productId)) ?? null;
  const priceNumber = Number(price);
  const stockNumber = Math.trunc(Number(stock));
  const canAdd = picked && priceNumber > 0 && priceNumber <= picked.mrp && stockNumber >= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold">Add products from the Spaceborn catalog</h3>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a name or SKU…"
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      {catalog.error && <p className="mt-2 text-sm text-red-700">{catalog.error}</p>}
      {picked && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canAdd) void add(picked, priceNumber, stockNumber);
          }}
          className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3"
        >
          <p className="w-full text-sm font-semibold">{picked.name}</p>
          <label className="text-xs font-semibold text-slate-600">
            Your price (MRP {formatInr(picked.mrp)})
            <input type="number" min="1" max={picked.mrp} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus className="mt-1 block w-28 rounded border border-slate-300 px-2 py-1" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Units in stock
            <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1 block w-24 rounded border border-slate-300 px-2 py-1" />
          </label>
          <button disabled={!canAdd || adding} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
            {adding ? 'Adding…' : 'Add to inventory'}
          </button>
          <button type="button" onClick={() => setPicked(null)} className="px-2 py-1.5 text-xs font-semibold text-slate-600">
            Cancel
          </button>
        </form>
      )}
      <ul className="mt-2 divide-y divide-slate-100 text-sm">
        {catalog.loading && <li className="py-2 text-slate-400">Searching…</li>}
        {candidates?.map((p) => (
          <li key={p.productId} className="flex items-center justify-between py-2">
            <span>
              {p.name} <span className="text-xs text-slate-400">{p.sku} · MRP {formatInr(p.mrp)}</span>
            </span>
            <button onClick={() => pick(p)} className={`rounded px-2 py-1 text-xs font-semibold ${picked?.productId === p.productId ? 'bg-slate-200 text-slate-800' : 'bg-slate-900 text-white'}`}>
              {picked?.productId === p.productId ? 'Selected' : 'Add'}
            </button>
          </li>
        ))}
        {candidates?.length === 0 && <li className="py-2 text-slate-500">{query ? `Nothing in the catalog matches “${query}”.` : 'Everything in the catalog is already in your inventory.'}</li>}
      </ul>
    </div>
  );
}

export function InventoryPanel({ onChange }: { onChange: () => void }) {
  const { toast } = useFeedback();
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const inventory = useLoad(() => api<{ items: InventoryItem[] }>('/vendor/inventory?limit=100').then((r) => r.items), []);

  const apply = (saved: Saved) => {
    inventory.mutate((items) => items?.map((i) => (i.productId === saved.productId ? { ...i, ...saved } : i)) ?? items);
    onChange();
  };
  const added = (item: InventoryItem) => {
    inventory.mutate((items) => [item, ...(items ?? []).filter((i) => i.productId !== item.productId)]);
    onChange();
  };

  const items = inventory.data ?? [];
  const counts = useMemo(
    () => ({ all: items.length, low: items.filter((i) => i.stock <= LOW_STOCK).length, hidden: items.filter((i) => !i.isListed).length }),
    [items],
  );
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (view === 'all' || (view === 'low' ? i.stock <= LOW_STOCK : !i.isListed)) &&
        (!needle || i.name.toLowerCase().includes(needle) || i.sku.toLowerCase().includes(needle)),
    );
  }, [items, view, search]);
  const owned = useMemo(() => new Set(items.map((i) => i.productId)), [items]);

  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${view === v ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {VIEWS[v]} <span className={view === v ? 'text-slate-300' : 'text-slate-400'}>{counts[v]}</span>
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or SKU"
            className="ml-auto w-48 rounded-lg border border-slate-300 px-3 py-1 text-xs"
          />
          <button
            onClick={() => void inventory.refresh().then(() => toast('Inventory refreshed', 'info'))}
            disabled={inventory.refreshing}
            className="text-xs font-semibold text-slate-600 underline disabled:opacity-50"
          >
            {inventory.refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {inventory.error && <p className="text-sm text-red-700">{inventory.error}</p>}
        {inventory.loading && <p className="py-4 text-center text-sm text-slate-400">Loading inventory…</p>}
        {!inventory.loading && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-2">Product</th>
                <th className="pb-2">Price (₹)</th>
                <th className="pb-2">Stock</th>
                <th className="pb-2">Adjust</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <Row key={item.productId} item={item} onSaved={apply} />
              ))}
            </tbody>
          </table>
        )}
        {!inventory.loading && items.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No products yet. Add some from the catalog below.</p>}
        {!inventory.loading && items.length > 0 && visible.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Nothing matches this filter.</p>}
      </div>
      <AddFromCatalog owned={owned} onAdded={added} />
    </section>
  );
}
