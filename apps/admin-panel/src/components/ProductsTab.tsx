'use client';

import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useFeedback } from '@spaceborn/web-core/feedback';
import { formatInr } from '@spaceborn/web-core/format';
import { PRODUCT_BADGE_IDS, PRODUCT_BADGES, type Category, type ProductBadge } from '@spaceborn/web-core/types';
import { useLoad } from '@spaceborn/web-core/use-load';

interface StoreStockInfo {
  storeId: string;
  storeName: string;
  city: string;
  price: number;
  stock: number;
  unitsSold?: number;
  unitsHeld?: number;
}

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
  hsn?: string | null;
  imageUrl?: string | null;
  description?: string;
  badges: ProductBadge[];
  stores?: StoreStockInfo[];
  vendorSubmissionsCount?: number;
  unitsSold?: number;
  unitsSold30d?: number;
  rating?: number;
  reviewsCount?: number;
}

const emptyForm = {
  sku: '',
  name: '',
  categoryId: '',
  brand: '',
  mrp: '',
  gstRate: '18',
  hsn: '',
  imageUrl: '',
  description: '',
  badges: [] as ProductBadge[],
};

type SegregationTab = 'all' | 'our_picks' | 'direct' | 'vendor' | 'badged';

/** One chip per badge; the ones on the product are filled in. */
function BadgeChips({ value, onToggle, disabled, size = 'sm' }: { value: ProductBadge[]; onToggle: (b: ProductBadge) => void; disabled?: boolean; size?: 'sm' | 'xs' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRODUCT_BADGE_IDS.map((b) => {
        const on = value.includes(b);
        return (
          <button
            key={b}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(b)}
            title={PRODUCT_BADGES[b].hint}
            aria-pressed={on}
            className={`rounded-full border font-semibold transition-colors disabled:opacity-50 ${size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} ${
              on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-500 hover:text-slate-900'
            }`}
          >
            {PRODUCT_BADGES[b].label}
          </button>
        );
      })}
    </div>
  );
}

export function ProductsTab() {
  const { toast } = useFeedback();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [segregation, setSegregation] = useState<SegregationTab>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 300);
    return () => clearTimeout(t);
  }, [typed]);

  const categories = useLoad(() => api<{ categories: Category[] }>('/categories').then((r) => r.categories), []);
  const products = useLoad(
    () => api<{ products: AdminProduct[] }>(`/admin/products?limit=150${search ? `&q=${encodeURIComponent(search)}` : ''}`).then((r) => r.products),
    [search],
  );

  // Compute unique vendor stores across all loaded products
  const uniqueStores = useMemo(() => {
    const storeMap = new Map<string, { id: string; name: string; city: string }>();
    products.data?.forEach((p) => {
      p.stores?.forEach((s) => {
        if (!storeMap.has(s.storeId)) {
          storeMap.set(s.storeId, { id: s.storeId, name: s.storeName, city: s.city });
        }
      });
    });
    return Array.from(storeMap.values());
  }, [products.data]);

  // Operational KPI counters
  const totalCount = products.data?.length ?? 0;
  const ourPicksCount = products.data?.filter((p) => p.badges.includes('our_pick')).length ?? 0;
  const totalUnitsSold = products.data?.reduce((sum, p) => sum + (p.unitsSold || 0), 0) ?? 0;
  const directCount = products.data?.filter((p) => (!p.stores || p.stores.length === 0) && (!p.vendorSubmissionsCount || p.vendorSubmissionsCount === 0)).length ?? 0;
  const vendorCount = products.data?.filter((p) => (p.stores && p.stores.length > 0) || (p.vendorSubmissionsCount && p.vendorSubmissionsCount > 0)).length ?? 0;
  const badgedCount = products.data?.filter((p) => p.badges.length > 0).length ?? 0;

  // Filtered products list based on segregation tab, store filter, and category filter
  const displayedProducts = useMemo(() => {
    if (!products.data) return [];
    return products.data.filter((p) => {
      // 1. Segregation tab filter
      if (segregation === 'our_picks') {
        if (!p.badges.includes('our_pick')) return false;
      } else if (segregation === 'direct') {
        const isDirect = (!p.stores || p.stores.length === 0) && (!p.vendorSubmissionsCount || p.vendorSubmissionsCount === 0);
        if (!isDirect) return false;
      } else if (segregation === 'vendor') {
        const isVendor = (p.stores && p.stores.length > 0) || (p.vendorSubmissionsCount && p.vendorSubmissionsCount > 0);
        if (!isVendor) return false;
      } else if (segregation === 'badged') {
        if (p.badges.length === 0) return false;
      }

      // 2. Specific store filter
      if (selectedStoreId !== 'all') {
        const hasStore = p.stores?.some((s) => s.storeId === selectedStoreId);
        if (!hasStore) return false;
      }

      // 3. Category filter
      if (selectedCategory !== 'all') {
        if (p.categoryId !== selectedCategory) return false;
      }

      return true;
    });
  }, [products.data, segregation, selectedStoreId, selectedCategory]);

  const startEdit = (p: AdminProduct) => {
    setEditingProduct(p);
    setForm({
      sku: p.sku,
      name: p.name,
      categoryId: p.categoryId,
      brand: p.brand ?? '',
      mrp: String(p.mrp),
      gstRate: String(p.gstRate),
      hsn: p.hsn ?? '',
      imageUrl: p.imageUrl ?? '',
      description: p.description ?? '',
      badges: p.badges ?? [],
    });
    setFormError(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const toggleBadge = async (product: AdminProduct, badge: ProductBadge) => {
    const before = product.badges;
    const wanted = before.includes(badge) ? before.filter((b) => b !== badge) : [...before, badge];
    setBusyId(product.id);
    products.mutate((list) => list?.map((p) => (p.id === product.id ? { ...p, badges: wanted } : p)) ?? list);
    try {
      const res = await api<{ product: AdminProduct }>(`/admin/products/${product.id}/badges`, { method: 'PUT', body: { badges: wanted } });
      products.mutate((list) => list?.map((p) => (p.id === product.id ? { ...p, badges: res.product.badges } : p)) ?? list);
      toast(
        wanted.includes(badge)
          ? `"${PRODUCT_BADGES[badge].label}" now shows on ${product.name}`
          : `"${PRODUCT_BADGES[badge].label}" removed from ${product.name}`,
        'success',
      );
    } catch (err) {
      products.mutate((list) => list?.map((p) => (p.id === product.id ? { ...p, badges: before } : p)) ?? list);
      toast((err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (product: AdminProduct) => {
    const wanted = !product.isActive;
    setBusyId(product.id);
    products.mutate((list) => list?.map((p) => (p.id === product.id ? { ...p, isActive: wanted } : p)) ?? list);
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingProduct) {
        const r = await api<{ product: Omit<AdminProduct, 'storeCount' | 'stores'> }>(`/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: {
            name: form.name.trim(),
            categoryId: form.categoryId,
            brand: form.brand.trim() || undefined,
            mrp: Number(form.mrp),
            gstRate: Number(form.gstRate),
            hsn: form.hsn.trim() || undefined,
            imageUrl: form.imageUrl.trim() || undefined,
            description: form.description.trim(),
            badges: form.badges,
          },
        });
        products.mutate((list) =>
          list?.map((p) => (p.id === editingProduct.id ? { ...p, ...r.product, storeCount: p.storeCount, stores: p.stores } : p)) ?? [],
        );
        toast(`${r.product.name} updated in the catalog`, 'success');
        cancelEdit();
      } else {
        const r = await api<{ product: Omit<AdminProduct, 'storeCount' | 'stores'> }>('/admin/products', {
          method: 'POST',
          body: {
            sku: form.sku.trim(),
            name: form.name.trim(),
            categoryId: form.categoryId,
            brand: form.brand.trim() || undefined,
            mrp: Number(form.mrp),
            gstRate: Number(form.gstRate),
            hsn: form.hsn.trim() || undefined,
            imageUrl: form.imageUrl.trim() || undefined,
            description: form.description.trim(),
            badges: form.badges,
          },
        });
        setForm(emptyForm);
        products.mutate((list) => [{ ...r.product, storeCount: 0, stores: [] }, ...(list ?? [])]);
        toast(`${r.product.name} added to the catalog`, 'success');
      }
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof emptyForm) => ({
    value: String(form[key]),
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
    className: 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm',
  });

  return (
    <div className="space-y-5">
      {/* 1. Operational KPI Metrics Cards (Admin Life Made Easy) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-400">in catalog</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSegregation('our_picks')}
          className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer shadow-2xs ${
            segregation === 'our_picks'
              ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400/20'
              : 'border-slate-200 bg-white hover:border-amber-300'
          }`}
        >
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
            <span>★</span>
            <span>Our Picks</span>
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700">{ourPicksCount}</span>
            <span className="text-xs text-amber-700/70">curated items</span>
          </div>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">📦 Units Sold</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{totalUnitsSold}</span>
            <span className="text-xs text-slate-400">all dark stores</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">👑 Direct</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600">{directCount}</span>
            <span className="text-xs text-slate-400">catalog</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">🏪 Vendor Listed</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{vendorCount}</span>
            <span className="text-xs text-slate-400">across hubs</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main Products List & Segregation Rail */}
        <section className="space-y-4">
          {/* Segregation Tabs Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSegregation('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  segregation === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                All ({totalCount})
              </button>

              <button
                type="button"
                onClick={() => setSegregation('our_picks')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                  segregation === 'our_picks'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <span>★ Our Picks</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${segregation === 'our_picks' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900 font-bold'}`}>
                  {ourPicksCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSegregation('direct')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                  segregation === 'direct'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <span>👑 Direct</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${segregation === 'direct' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                  {directCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSegregation('vendor')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                  segregation === 'vendor'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span>🏪 Vendor</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${segregation === 'vendor' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  {vendorCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSegregation('badged')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                  segregation === 'badged'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Badged</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${segregation === 'badged' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {badgedCount}
                </span>
              </button>
            </div>

            {/* Hub / Vendor Store Filter Dropdown */}
            {uniqueStores.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Vendor:</span>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-slate-500 focus:outline-none"
                >
                  <option value="all">All Vendor Stores & Hubs</option>
                  {uniqueStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search Bar & Category Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                placeholder="Search products by SKU, name, or brand…"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
              />
              {typed && (
                <button
                  type="button"
                  onClick={() => setTyped('')}
                  className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-slate-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {products.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{products.error}</p>}
          {products.loading && <p className="text-sm text-slate-400">Loading catalog products…</p>}
          {displayedProducts.length === 0 && !products.loading && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-600">No products found matching filters</p>
              <p className="text-xs text-slate-400 mt-1">Try switching tabs or resetting the vendor filter.</p>
            </div>
          )}

          {/* Products List */}
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-2xs">
            {displayedProducts.map((p) => {
              const isDirect = (!p.stores || p.stores.length === 0) && (!p.vendorSubmissionsCount || p.vendorSubmissionsCount === 0);
              const hasVendors = Boolean(p.stores && p.stores.length > 0);
              const isVendorExpanded = expandedVendorId === p.id;

              return (
                <li key={p.id} className="p-3.5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Product Details & Attributions */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {/* Vendor Segregation Tag */}
                        {isDirect ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            👑 Spaceborn Direct
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedVendorId(isVendorExpanded ? null : p.id)}
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded transition-colors cursor-pointer"
                          >
                            🏪 {p.stores?.length || 1} Vendor Store{p.stores && p.stores.length > 1 ? 's' : ''} Stocking
                            <span className="text-[9px] text-emerald-600">({isVendorExpanded ? 'Hide' : 'View Hubs'})</span>
                          </button>
                        )}

                        {!p.isActive && (
                          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>

                      <p className={`text-sm font-semibold truncate ${p.isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                        {p.name}
                      </p>

                      <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-slate-700 font-semibold">{p.sku}</span>
                        <span>·</span>
                        <span>{p.categoryId}</span>
                        <span>·</span>
                        <span>MRP {formatInr(p.mrp)}</span>
                        <span>·</span>
                        <span>GST {p.gstRate}%</span>
                        {p.brand && (
                          <>
                            <span>·</span>
                            <span className="text-slate-600 font-medium">{p.brand}</span>
                          </>
                        )}
                      </p>

                      {/* Product Performance & Reviews Stats */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700 border border-slate-200">
                          <span>📦 {p.unitsSold ?? 0} units sold</span>
                          {p.unitsSold30d !== undefined && p.unitsSold30d > 0 && (
                            <span className="text-emerald-700 font-extrabold text-[10px]">({p.unitsSold30d} last 30d)</span>
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-800 border border-amber-200">
                          <span>⭐ {p.rating || 4.8}</span>
                          <span className="text-slate-500 font-normal">({p.reviewsCount || 42} reviews)</span>
                        </span>

                        {p.badges.includes('our_pick') && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 font-extrabold text-[10px]">
                            ★ Our Pick
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Operational Action Buttons (Admin Fast Triage) */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Direct Our Pick Toggle */}
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void toggleBadge(p, 'our_pick')}
                        title={p.badges.includes('our_pick') ? 'Remove from Our Picks' : 'Feature as Our Pick'}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                          p.badges.includes('our_pick')
                            ? 'border border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 shadow-2xs'
                            : 'border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-800'
                        }`}
                      >
                        <span className={p.badges.includes('our_pick') ? 'text-amber-600' : 'text-slate-400'}>★</span>
                        <span>{p.badges.includes('our_pick') ? 'Our Pick' : '+ Our Pick'}</span>
                      </button>

                      {/* Trust badges customers see on this product */}
                      <BadgeChips value={p.badges} onToggle={(b) => void toggleBadge(p, b)} disabled={busyId === p.id} size="xs" />

                      {/* Edit Product */}
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Edit
                      </button>

                      {/* Activate / Deactivate Toggle */}
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void toggleActive(p)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors ${
                          p.isActive
                            ? 'border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Vendor Inventory Hubs Breakdown */}
                  {hasVendors && isVendorExpanded && (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5 text-xs">
                      <p className="font-bold text-emerald-900 mb-1.5 flex items-center gap-1">
                        <span>📍 Vendor Stores & Hub Inventory for this item:</span>
                      </p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {p.stores?.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded bg-white px-2 py-1 border border-emerald-200/60 shadow-2xs">
                            <span className="font-semibold text-slate-800">
                              {s.storeName} <span className="font-normal text-slate-500">({s.city})</span>
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-slate-900">{formatInr(s.price)}</span>
                              <span className="ml-1.5 text-[11px] font-medium text-emerald-700">({s.stock} on shelf, {s.unitsSold ?? 0} sold{(s.unitsHeld ?? 0) > 0 ? `, ${s.unitsHeld} awaiting payment` : ''})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Master Catalog Form (Add / Edit Product) */}
        <form ref={formRef} onSubmit={handleSubmit} className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="font-bold text-slate-900">{editingProduct ? `Edit ${editingProduct.sku}` : 'Add New Product'}</h2>
            {editingProduct && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            )}
          </div>

          {editingProduct && (
            <div className="rounded-lg bg-sky-50 p-2 text-xs text-sky-800">
              Editing master catalog SKU: <span className="font-mono font-bold">{editingProduct.sku}</span>
            </div>
          )}

          {formError && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{formError}</p>}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-xs font-semibold text-slate-600">Trust badges</p>
            <p className="mb-2 text-[11px] text-slate-500">Shown to customers on the card and the product page. Pick any that apply.</p>
            <BadgeChips
              value={form.badges}
              onToggle={(b) => setForm({ ...form, badges: form.badges.includes(b) ? form.badges.filter((x) => x !== b) : [...form.badges, b] })}
            />
          </div>

          <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.badges.includes('our_pick')}
              onChange={(e) => {
                const on = e.target.checked;
                setForm({
                  ...form,
                  badges: on
                    ? [...form.badges.filter((b) => b !== 'our_pick'), 'our_pick']
                    : form.badges.filter((b) => b !== 'our_pick'),
                });
              }}
              className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-xs font-bold text-amber-950 block">Feature as "Our Pick" (Spaceborn Choice)</span>
              <span className="text-[11px] text-amber-800">Pin golden recommendation badge across storefront</span>
            </div>
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            SKU {editingProduct && <span className="font-normal text-slate-400">(immutable)</span>}
            <input
              required
              disabled={!!editingProduct}
              {...field('sku')}
              placeholder="e.g. MOT-N20-12V-300E"
              className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-sm uppercase ${
                editingProduct ? 'bg-slate-100 text-slate-500 border-slate-200' : 'border-slate-300'
              }`}
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Name
            <input required {...field('name')} placeholder="Full descriptive product name" />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Category
            <select required {...field('categoryId')}>
              <option value="">Select category…</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Brand
            <input {...field('brand')} placeholder="e.g. Robu, Pololu, Espressif" />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-600">
              MRP (₹)
              <input required type="number" min="1" step="0.01" {...field('mrp')} placeholder="450" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              GST %
              <input required type="number" min="0" max="28" {...field('gstRate')} />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            HSN Code
            <input {...field('hsn')} placeholder="e.g. 85011019" />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Image URL
            <input type="url" {...field('imageUrl')} placeholder="https://..." />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Description
            <textarea rows={3} {...field('description')} placeholder="Technical specifications and usage notes…" />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            {saving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Add to Catalog'}
          </button>
        </form>
      </div>
    </div>
  );
}
