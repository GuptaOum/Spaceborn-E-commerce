'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { PRODUCT_BADGES, type CatalogOffer, type GeoPoint } from '@spaceborn/web-core/types';
import { Product, AppView } from '../types';
import { ProductCard } from '../components/ProductCard';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Lock,
  MapPin,
  Minus,
  Plus,
  Share2,
  ShoppingCart,
  Store,
  Timer,
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  allProducts: Product[];
  onAddToCart: (p: Product, qty: number) => void;
  onBuyNow: (p: Product, qty: number) => void;
  onSelectProduct: (p: Product) => void;
  onNavigate: (view: AppView) => void;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  allProducts,
  onAddToCart,
  onBuyNow,
  onSelectProduct,
  onNavigate,
}) => {
  const images = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];
  const [selectedImage, setSelectedImage] = useState(images[0]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pincode, setPincode] = useState('');
  const [pinStatus, setPinStatus] = useState<{ tone: 'ok' | 'warn' | 'muted'; text: string } | null>(null);
  // Hover zoom: where the cursor is over the image, as percentages, so the magnified area follows it.
  const [zoomAt, setZoomAt] = useState<{ x: number; y: number } | null>(null);
  const ZOOM = 2.2;

  const trackZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomAt({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  useEffect(() => {
    setSelectedImage(images[0]);
    setQuantity(1);
    setPinStatus(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= 5;
  const total = product.price * quantity;
  // The shown price is the nearest shop's. Units beyond its stock ship from a farther shop at
  // that shop's price, so the exact amount is only known at checkout.
  const spillsOver = product.nearestStock !== undefined && quantity > product.nearestStock;
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;
  const specs = Object.entries(product.specifications ?? {});
  const badges = product.badges ?? (product.isChoice ? ['our_pick' as const] : []);
  const related = allProducts.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);

  const setQty = (n: number) => setQuantity(Math.max(1, Math.min(Math.max(product.stock, 1), n)));

  const handleAdd = () => {
    onAddToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; nothing to show */
    }
  };

  const checkPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.length !== 6) {
      setPinStatus({ tone: 'warn', text: 'Enter a 6-digit PIN code.' });
      return;
    }
    setPinStatus({ tone: 'muted', text: 'Checking…' });
    let point: GeoPoint;
    try {
      ({ location: point } = await api<{ location: GeoPoint }>(`/geo/pincode/${pincode}`));
    } catch {
      setPinStatus({ tone: 'warn', text: `We could not find PIN ${pincode}.` });
      return;
    }
    try {
      const { product: offer } = await api<{ product: CatalogOffer }>(
        `/catalog/products/${encodeURIComponent(product.id)}?lat=${point.latitude}&lng=${point.longitude}`,
      );
      setPinStatus(
        (offer.nearbyStock ?? offer.stock) > 0
          ? { tone: 'ok', text: `Delivers to ${pincode} in about ${offer.etaMinutes} min. ${offer.nearbyStock ?? offer.stock} in stock there.` }
          : { tone: 'warn', text: `This item is listed near ${pincode} but it is out of stock right now.` },
      );
    } catch {
      setPinStatus({ tone: 'warn', text: `This item is not available near ${pincode} yet.` });
    }
  };

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-3 sm:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-3 text-xs text-[#7a6274]">
          <ol className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
            <li>
              <button onClick={() => onNavigate('home')} className="hover:text-[#34222e] cursor-pointer">Home</button>
            </li>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <li>
              <button onClick={() => onNavigate('catalog')} className="hover:text-[#34222e] cursor-pointer">{product.category}</button>
            </li>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <li className="truncate max-w-[14rem] sm:max-w-md text-[#34222e] font-medium">{product.name}</li>
          </ol>
          <button
            onClick={() => void handleShare()}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#f9bf8f]/60 bg-[#fffbf7] px-2.5 py-1.5 hover:text-[#34222e] cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copied ? 'Link copied' : 'Share'}
          </button>
        </nav>

        {/* Main card */}
        <section className="rounded-2xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-3.5 sm:p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
            {/* Gallery */}
            <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-24 self-start">
              <div
                className="relative flex h-64 sm:h-96 items-center justify-center overflow-hidden rounded-xl border border-[#f9bf8f]/50 bg-white p-4 sm:p-6 lg:cursor-zoom-in"
                onMouseMove={trackZoom}
                onMouseLeave={() => setZoomAt(null)}
              >
                <img
                  src={selectedImage}
                  alt={product.name}
                  draggable={false}
                  className={`max-h-full max-w-full select-none object-contain ${zoomAt ? '' : 'transition-transform duration-200 ease-out'}`}
                  style={{
                    transform: zoomAt ? `scale(${ZOOM})` : 'scale(1)',
                    transformOrigin: zoomAt ? `${zoomAt.x}% ${zoomAt.y}%` : 'center',
                  }}
                />
                {!zoomAt && (
                  <span className="pointer-events-none absolute bottom-3 right-3 hidden rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-[#7a6274] shadow-sm lg:block">
                    Hover to zoom
                  </span>
                )}
                {!inStock && (
                  <span className="absolute left-3 top-3 rounded-md bg-[#34222e] px-2 py-1 text-xs font-semibold text-white">Out of stock</span>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(img)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white p-1 cursor-pointer ${
                        selectedImage === img ? 'border-[#0c831f] ring-2 ring-[#0c831f]/20' : 'border-[#f9bf8f]/50 hover:border-[#0c831f]/50'
                      }`}
                    >
                      <img src={img} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="lg:col-span-7 space-y-5">
              <div className="space-y-2">
                <p className="text-xs text-[#7a6274]">
                  {product.brand && <span className="font-semibold text-[#34222e]">{product.brand}</span>}
                  {product.brand && <span className="mx-1.5">·</span>}
                  <span className="font-mono">{product.sku}</span>
                </p>
                <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{product.name}</h1>
                {badges.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 pt-0.5">
                    {badges.map((b) => (
                      <li
                        key={b}
                        title={PRODUCT_BADGES[b]?.hint}
                        className="inline-flex items-center gap-1 rounded-md bg-[#34222e] px-2 py-1 text-xs font-semibold text-white"
                      >
                        <BadgeCheck className="w-3.5 h-3.5" />
                        {PRODUCT_BADGES[b]?.label ?? b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#f9bf8f]/50 bg-white px-3.5 py-2.5 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-[#0c831f]" />
                  Combined stock near you
                </span>
                {product.deliveryMins && (
                  <span className="inline-flex items-center gap-1.5 text-[#0c831f] font-semibold">
                    <Timer className="w-4 h-4" />
                    Delivers in about {product.deliveryMins} min
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="text-3xl font-semibold tracking-tight">{inr(product.price)}</span>
                  {discount > 0 && product.originalPrice && (
                    <>
                      <span className="text-sm text-[#7a6274] line-through">MRP {inr(product.originalPrice)}</span>
                      <span className="rounded-md bg-[#f2fcf4] px-2 py-0.5 text-xs font-semibold text-[#0c831f]">{discount}% off</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-[#7a6274]">
                  Inclusive of {product.gstRate || 18}% GST
                  {inStock ? (
                    <span className={`ml-2 font-semibold ${lowStock ? 'text-[#e2434b]' : 'text-[#0c831f]'}`}>
                      {lowStock ? `Only ${product.stock} left near you` : `In stock near you (${product.stock})`}
                    </span>
                  ) : (
                    <span className="ml-2 font-semibold text-[#e2434b]">Out of stock near you</span>
                  )}
                </p>
              </div>

              {/* Buy box */}
              <div className="space-y-3 rounded-xl border border-[#f9bf8f]/60 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-lg border border-[#f9bf8f]">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty(quantity - 1)}
                      disabled={!inStock || quantity <= 1}
                      className="flex h-10 w-10 items-center justify-center hover:bg-[#fee9d7] disabled:opacity-40 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                      disabled={!inStock}
                      className="h-10 w-14 border-x border-[#f9bf8f] bg-white text-center text-sm font-semibold outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQty(quantity + 1)}
                      disabled={!inStock || quantity >= product.stock}
                      className="flex h-10 w-10 items-center justify-center hover:bg-[#fee9d7] disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-sm text-[#7a6274]">
                    {spillsOver ? 'From ' : 'Total '}
                    <span className="font-semibold text-[#34222e]">{inr(total)}</span>
                  </span>
                </div>
                {spillsOver && (
                  <p className="text-xs text-[#7a6274]">
                    {product.nearestStock} of these are at the shown price. The rest ship from farther away and may cost a little
                    more; the exact total is shown at checkout before you pay.
                  </p>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={handleAdd}
                    disabled={!inStock}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      added ? 'bg-[#0a701a]' : 'bg-[#0c831f] hover:bg-[#0a701a]'
                    }`}
                  >
                    {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                    {added ? 'Added to cart' : 'Add to cart'}
                  </button>
                  <button
                    onClick={() => onBuyNow(product, quantity)}
                    disabled={!inStock}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#34222e] text-sm font-semibold text-white hover:bg-[#20151c] transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    Buy now
                  </button>
                </div>

                <form onSubmit={(e) => void checkPin(e)} className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-t border-[#f9bf8f]/40 pt-3 text-sm">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <MapPin className="w-4 h-4 text-[#7a6274] shrink-0" />
                    <label htmlFor="pin-check" className="text-[#7a6274] text-xs sm:text-sm shrink-0">Check PIN</label>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                    <input
                      id="pin-check"
                      inputMode="numeric"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit PIN"
                      className="h-9 flex-1 sm:w-32 min-w-0 rounded-lg border border-[#f9bf8f] px-3 text-sm outline-none focus:border-[#0c831f]"
                    />
                    <button type="submit" className="h-9 shrink-0 rounded-lg border border-[#34222e] px-3 text-sm font-semibold hover:bg-[#34222e] hover:text-white transition cursor-pointer">
                      Check
                    </button>
                  </div>
                  {pinStatus && (
                    <p className={`basis-full text-xs ${pinStatus.tone === 'ok' ? 'text-[#0c831f]' : pinStatus.tone === 'warn' ? 'text-[#e2434b]' : 'text-[#7a6274]'}`}>
                      {pinStatus.text}
                    </p>
                  )}
                </form>
              </div>

              <ul className="grid gap-1.5 text-sm text-[#7a6274] sm:grid-cols-2">
                <li>Packed and delivered from the stock nearest to you.</li>
                <li>Pay by UPI, card or net banking at checkout.</li>
                <li>Cancel from your orders page until your order is accepted.</li>
                <li>Delivery is free on orders of ₹499 or more.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Description and specs */}
        {(product.description || specs.length > 0) && (
          <section className="grid gap-6 rounded-2xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-3.5 sm:p-6 lg:grid-cols-12 lg:p-8">
            {product.description && (
              <div className={specs.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}>
                <h2 className="text-base font-semibold">About this item</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#5f4a58]">{product.description}</p>
              </div>
            )}
            {specs.length > 0 && (
              <div className={product.description ? 'lg:col-span-7' : 'lg:col-span-12'}>
                <h2 className="text-base font-semibold">Specifications</h2>
                <dl className="mt-2 overflow-hidden rounded-xl border border-[#f9bf8f]/50 bg-white text-sm">
                  {specs.map(([key, value], i) => (
                    <div key={key} className={`grid grid-cols-1 sm:grid-cols-[minmax(7rem,1fr)_2fr] gap-1 sm:gap-3 px-3.5 sm:px-4 py-2 sm:py-2.5 ${i > 0 ? 'border-t border-[#f9bf8f]/30' : ''}`}>
                      <dt className="text-[#7a6274] text-xs sm:text-sm">{key}</dt>
                      <dd className="font-medium text-xs sm:text-sm">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">More in {product.category}</h2>
              <button onClick={() => onNavigate('catalog')} className="inline-flex items-center gap-1 text-sm font-semibold text-[#e2434b] hover:text-[#c7323a] cursor-pointer">
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={onSelectProduct} onAddToCart={(prod, qty) => onAddToCart(prod, qty || 1)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
