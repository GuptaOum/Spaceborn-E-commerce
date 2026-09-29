'use client';

import { useState } from 'react';
import { api } from '@spaceborn/web-core/api';
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

async function saveInventory(productId: string, body: Record<string, unknown>) {
  try {
    await api(`/vendor/inventory/${productId}`, { method: 'PUT', body });
    return true;
  } catch (err) {
    alert((err as Error).message);
    return false;
  }
}

function Row({ item, onSaved }: { item: InventoryItem; onSaved: () => void }) {
  const [price, setPrice] = useState(String(item.price));
  const [delta, setDelta] = useState('');
  const [saving, setSaving] = useState(false);

  const run = async (body: Record<string, unknown>) => {
    setSaving(true);
    if (await saveInventory(item.productId, body)) {
      setDelta('');
      onSaved();
    }
    setSaving(false);
  };

  const priceChanged = Number(price) !== item.price;
  const deltaNumber = Number(delta);

  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 pr-2">
        <p className="font-semibold">{item.name}</p>
        <p className="text-xs text-slate-400">
          {item.sku} · MRP {formatInr(item.mrp)}
        </p>
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min="1"
          max={item.mrp}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 rounded border border-slate-300 px-2 py-1"
        />
      </td>
      <td className={`py-2 pr-2 font-bold ${item.stock <= 5 ? 'text-amber-600' : ''}`}>{item.stock}</td>
      <td className="py-2 pr-2">
        <input
          type="number"
          placeholder="+10 / -2"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="w-24 rounded border border-slate-300 px-2 py-1"
        />
      </td>
      <td className="space-x-2 py-2 whitespace-nowrap">
        <button
          disabled={saving || (!priceChanged && !deltaNumber)}
          onClick={() =>
            run({
              ...(priceChanged ? { price: Number(price) } : {}),
              ...(deltaNumber ? { stockDelta: Math.trunc(deltaNumber) } : {}),
            })
          }
          className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
        <button
          disabled={saving}
          onClick={() => run({ isListed: !item.isListed })}
          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold"
        >
          {item.isListed ? 'Unlist' : 'List'}
        </button>
      </td>
    </tr>
  );
}

function AddFromCatalog({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const catalog = useLoad(
    () =>
      api<{ products: CatalogEntry[] }>(`/vendor/catalog?limit=20${query ? `&q=${encodeURIComponent(query)}` : ''}`).then(
        (r) => r.products,
      ),
    [query],
  );

  const add = async (product: CatalogEntry) => {
    const price = prompt(`Your selling price for ${product.name} (MRP ₹${product.mrp})`, String(product.mrp));
    if (!price) return;
    const stock = prompt('Units in stock right now', '10');
    if (!stock) return;
    if (await saveInventory(product.productId, { price: Number(price), stock: Math.trunc(Number(stock)) })) {
      await catalog.reload();
      onAdded();
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold">Add products from the Spaceborn catalog</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or SKU"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">Search</button>
      </form>
      {catalog.error && <p className="mt-2 text-sm text-red-700">{catalog.error}</p>}
      <ul className="mt-2 divide-y divide-slate-100 text-sm">
        {catalog.data?.map((p) => (
          <li key={p.productId} className="flex items-center justify-between py-2">
            <span>
              {p.name} <span className="text-xs text-slate-400">MRP {formatInr(p.mrp)}</span>
            </span>
            <button onClick={() => add(p)} className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
              Add
            </button>
          </li>
        ))}
        {catalog.data?.length === 0 && <li className="py-2 text-slate-500">Nothing new to add.</li>}
      </ul>
    </div>
  );
}

export function InventoryPanel({ onChange }: { onChange: () => void }) {
  const inventory = useLoad(() => api<{ items: InventoryItem[] }>('/vendor/inventory?limit=100').then((r) => r.items), []);

  const refresh = () => {
    void inventory.reload();
    onChange();
  };

  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
        {inventory.error && <p className="text-sm text-red-700">{inventory.error}</p>}
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
            {inventory.data?.map((item) => (
              <Row key={`${item.productId}:${item.price}:${item.stock}:${item.isListed}`} item={item} onSaved={refresh} />
            ))}
          </tbody>
        </table>
        {inventory.data?.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No products listed yet.</p>}
      </div>
      <AddFromCatalog onAdded={refresh} />
    </section>
  );
}
