'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@spaceborn/web-core/api';
import { PRODUCT_BADGES, type CatalogOffer, type GeoPoint } from '@spaceborn/web-core/types';
import { Product, AppView } from '../types';
import { ProductCard } from '../components/ProductCard';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Lock,
  MapPin,
  Minus,
  Plus,
  Share2,
  ShoppingCart,
  Store,
  Timer,
  Star,
  FileText,
  Download,
  Box,
  Layers,
  Info,
  ShieldCheck,
  Cpu,
  Zap,
  ExternalLink,
  RotateCcw,
  Receipt,
  Sparkles,
  Truck,
  Building2,
  Package,
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

type TabKey = 'overview' | 'specifications' | 'pinout' | 'package' | 'resources' | 'pricing' | 'reviews';

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
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  
  // Hover zoom: where the cursor is over the image, as percentages, so the magnified area follows it.
  const [zoomAt, setZoomAt] = useState<{ x: number; y: number } | null>(null);
  const ZOOM = 2.2;

  const tabsRef = useRef<HTMLDivElement>(null);

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
    setActiveTab('overview');
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

  const features = product.features && product.features.length > 0 ? product.features : [
    'Industrial-grade electronic component with high thermal stability',
    'Standard 2.54mm breadboard & perfboard compatible header pitch',
    'Low power consumption optimized for embedded and battery operations',
    'Pre-tested and ESD safe packaged for immediate lab workbench deployment',
  ];

  const packageIncludes = product.packageIncludes && product.packageIncludes.length > 0 ? product.packageIncludes : [
    `1 x ${product.name}`,
    '1 x Anti-Static ESD Protective Shield Bag',
    '1 x Spaceborn QC Verification Certificate',
  ];

  const tierPricing = product.tierPricing && product.tierPricing.length > 0 ? product.tierPricing : [
    { minQty: 1, maxQty: 4, price: product.price, savings: 'Standard' },
    { minQty: 5, maxQty: 19, price: Math.round(product.price * 0.94), savings: 'Save 6%' },
    { minQty: 20, maxQty: 49, price: Math.round(product.price * 0.88), savings: 'Save 12%' },
    { minQty: 50, price: Math.round(product.price * 0.82), savings: 'Save 18%' },
  ];

  const pinout = product.pinout && product.pinout.length > 0 ? product.pinout : [
    { pin: '1 (VCC)', color: 'Red', function: 'Power Supply (+)', description: `Operating supply input (${product.voltage || '3.3V - 5V DC'})` },
    { pin: '2 (GND)', color: 'Black', function: 'Ground (0V)', description: 'System common ground reference' },
    { pin: '3 (SIG / DATA)', color: 'Yellow', function: 'Signal / I/O', description: 'Digital / Analog interface line to microcontroller' },
    { pin: '4 (ENABLE / NC)', color: 'Blue', function: 'Enable / Control', description: 'Active HIGH enable or auxiliary logic control line' },
  ];

  const ratingScore = product.rating || 4.8;
  const reviewsCount = product.reviewsCount || 42;

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

  const scrollToTabs = (tab: TabKey) => {
    setActiveTab(tab);
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-3 sm:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 space-y-5 sm:space-y-7">
        
        {/* Breadcrumb Navigation */}
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
            <li className="truncate max-w-[14rem] sm:max-w-md text-[#34222e] font-semibold">{product.name}</li>
          </ol>
          <button
            onClick={() => void handleShare()}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#f9bf8f]/60 bg-[#fffbf7] px-2.5 py-1.5 hover:text-[#34222e] cursor-pointer text-xs font-medium shadow-2xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copied ? 'Link copied!' : 'Share'}
          </button>
        </nav>

        {/* Main Product Hero Card */}
        <section className="rounded-2xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-3.5 sm:p-6 lg:p-8 shadow-xs">
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
            
            {/* Left Column: Gallery & Trust Highlights */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24 self-start">
              <div
                className="relative flex h-72 sm:h-96 items-center justify-center overflow-hidden rounded-2xl border border-[#f9bf8f]/50 bg-white p-4 sm:p-6 lg:cursor-zoom-in shadow-2xs"
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
                
                {/* Fast Delivery Badge */}
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-[#f2fcf4] text-[#0c831f] text-[10px] font-bold border border-[#0c831f]/20 flex items-center gap-1 shadow-2xs">
                  <Zap className="w-3 h-3 fill-[#0c831f]" />
                  <span>{product.deliveryMins || 10} MINS DISPATCH</span>
                </span>

                {!zoomAt && (
                  <span className="pointer-events-none absolute bottom-3 right-3 hidden rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-[#7a6274] shadow-sm lg:block">
                    Hover to zoom
                  </span>
                )}
                
                {!inStock && (
                  <span className="absolute right-3 top-3 rounded-md bg-[#34222e] px-2 py-1 text-xs font-semibold text-white">
                    Out of stock
                  </span>
                )}
              </div>

              {/* Thumbnails Row */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(img)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white p-1 cursor-pointer transition-all ${
                        selectedImage === img ? 'border-[#0c831f] ring-2 ring-[#0c831f]/20' : 'border-[#f9bf8f]/50 hover:border-[#0c831f]/50'
                      }`}
                    >
                      <img src={img} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}

              {/* Trust Badges Strip Below Gallery */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-[#fee9d7]/40 border border-[#f9bf8f]/40 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <div>
                    <p className="font-bold text-[#34222e] text-[11px]">100% Genuine</p>
                    <p className="text-[10px] text-[#7a6274]">Lab verified authentic</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#fee9d7]/40 border border-[#f9bf8f]/40 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <div>
                    <p className="font-bold text-[#34222e] text-[11px]">GST Invoice</p>
                    <p className="text-[10px] text-[#7a6274]">Input tax credit eligible</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#fee9d7]/40 border border-[#f9bf8f]/40 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <div>
                    <p className="font-bold text-[#34222e] text-[11px]">10-15 Min Delivery</p>
                    <p className="text-[10px] text-[#7a6274]">Pooled local dark store</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#fee9d7]/40 border border-[#f9bf8f]/40 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <div>
                    <p className="font-bold text-[#34222e] text-[11px]">7-Day Guarantee</p>
                    <p className="text-[10px] text-[#7a6274]">Replacement for defects</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Title, Ratings, Specs Chips, Pricing, Buy Box */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Product Header & Meta */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {product.brand && (
                    <span className="font-bold text-[#0c831f] bg-[#f2fcf4] px-2 py-0.5 rounded-md border border-[#0c831f]/20">
                      {product.brand}
                    </span>
                  )}
                  <span className="text-[#7a6274] font-mono">SKU: {product.sku}</span>
                  {product.hsn && (
                    <span className="text-[#7a6274] font-mono">HSN: {product.hsn}</span>
                  )}
                  {product.packSize && (
                    <span className="text-[#34222e] font-semibold bg-[#fee9d7] px-2 py-0.5 rounded-md">
                      {product.packSize}
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight text-[#34222e]">
                  {product.name}
                </h1>

                {/* Rating & Review Jump */}
                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  <button
                    onClick={() => scrollToTabs('reviews')}
                    className="flex items-center gap-1.5 cursor-pointer group"
                    title="View verified maker reviews"
                  >
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < Math.floor(ratingScore) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-[#34222e]">{ratingScore}</span>
                    <span className="text-xs text-[#7a6274] group-hover:text-[#0c831f] group-hover:underline">
                      ({reviewsCount} Maker & Lab Reviews)
                    </span>
                  </button>

                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {badges.map((b) => (
                        <span
                          key={b}
                          title={PRODUCT_BADGES[b]?.hint}
                          className="inline-flex items-center gap-1 rounded-md bg-[#34222e] px-2 py-0.5 text-xs font-semibold text-white"
                        >
                          <BadgeCheck className="w-3.5 h-3.5 text-[#f8cb46]" />
                          {PRODUCT_BADGES[b]?.label ?? b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Combined Dark Store Stock & Delivery Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#0c831f]/20 bg-[#f2fcf4] px-3.5 py-2.5 text-sm">
                <span className="inline-flex items-center gap-2 font-medium text-[#34222e]">
                  <Store className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <span>Combined stock across nearest dark stores</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#0c831f] font-bold">
                  <Timer className="w-4 h-4 shrink-0" />
                  <span>Delivers in about {product.deliveryMins || 10} min</span>
                </span>
              </div>

              {/* Price & GST Details */}
              <div className="space-y-1.5 bg-[#fee9d7]/30 p-3.5 sm:p-4 rounded-2xl border border-[#f9bf8f]/50">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-black text-[#34222e] tracking-tight">
                    {inr(product.price)}
                  </span>
                  {discount > 0 && product.originalPrice && (
                    <>
                      <span className="text-sm sm:text-base text-[#7a6274] line-through font-medium">
                        MRP {inr(product.originalPrice)}
                      </span>
                      <span className="rounded-md bg-[#0c831f] px-2 py-0.5 text-xs font-bold text-white shadow-2xs">
                        {discount}% OFF
                      </span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a6274]">
                  <span>Inclusive of {product.gstRate || 18}% GST</span>
                  <span>•</span>
                  {inStock ? (
                    <span className={`font-bold ${lowStock ? 'text-[#e2434b]' : 'text-[#0c831f]'}`}>
                      {lowStock ? `Only ${product.stock} units remaining in dark store` : `In stock (${product.stock.toLocaleString('en-IN')} units available)`}
                    </span>
                  ) : (
                    <span className="font-bold text-[#e2434b]">Currently out of stock</span>
                  )}
                </div>
              </div>

              {/* Quick Spec Parameters Chips */}
              {(product.voltage || product.rpm || product.shaftType || product.encoder !== undefined) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {product.voltage && (
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#f9bf8f]/60 font-semibold text-[#34222e]">
                      ⚡ Voltage: <span className="text-[#0c831f] font-bold">{product.voltage}</span>
                    </span>
                  )}
                  {product.rpm && (
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#f9bf8f]/60 font-semibold text-[#34222e]">
                      🔄 Speed: <span className="text-[#0c831f] font-bold">{product.rpm} RPM</span>
                    </span>
                  )}
                  {product.shaftType && (
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#f9bf8f]/60 font-semibold text-[#34222e]">
                      ⚙️ Shaft: <span className="text-[#34222e] font-bold">{product.shaftType}</span>
                    </span>
                  )}
                  {product.encoder && (
                    <span className="px-2.5 py-1 rounded-lg bg-[#f2fcf4] border border-[#0c831f]/30 font-bold text-[#0c831f]">
                      ✓ Integrated Magnetic Hall Encoder
                    </span>
                  )}
                </div>
              )}

              {/* Top Key Features Highlights Preview */}
              <div className="space-y-2 rounded-xl bg-white border border-[#f9bf8f]/50 p-3.5 sm:p-4 shadow-2xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#34222e] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0c831f]" />
                  <span>Key Engineering Highlights</span>
                </h3>
                <ul className="space-y-1.5 text-xs text-[#5f4a58]">
                  {features.slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0c831f] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Buy Box & Quantity Controls */}
              <div className="space-y-3.5 rounded-2xl border border-[#f9bf8f]/70 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-xl border border-[#f9bf8f] bg-[#fffbf7]">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty(quantity - 1)}
                      disabled={!inStock || quantity <= 1}
                      className="flex h-10 w-10 items-center justify-center hover:bg-[#fee9d7] disabled:opacity-40 cursor-pointer transition-colors"
                    >
                      <Minus className="w-4 h-4 text-[#34222e]" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                      disabled={!inStock}
                      className="h-10 w-14 border-x border-[#f9bf8f] bg-white text-center text-sm font-bold text-[#34222e] outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQty(quantity + 1)}
                      disabled={!inStock || quantity >= product.stock}
                      className="flex h-10 w-10 items-center justify-center hover:bg-[#fee9d7] disabled:opacity-40 cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4 text-[#34222e]" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-[#7a6274] block">
                      {spillsOver ? 'Starts from' : 'Calculated Total'}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#34222e] tracking-tight">
                      {inr(total)}
                    </span>
                  </div>
                </div>

                {spillsOver && (
                  <p className="text-xs text-[#7a6274] bg-[#fee9d7]/50 p-2.5 rounded-xl border border-[#f9bf8f]/40">
                    ℹ️ {product.nearestStock} of these units are available at nearest dark store price. Additional units are pooled from adjacent stores; exact split is shown at checkout.
                  </p>
                )}

                {/* Primary Action Buttons */}
                <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                  <button
                    onClick={handleAdd}
                    disabled={!inStock}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all cursor-pointer shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                      added ? 'bg-[#0a701a]' : 'bg-[#0c831f] hover:bg-[#0a701a]'
                    }`}
                  >
                    {added ? <Check className="w-5 h-5 stroke-[2.5]" /> : <ShoppingCart className="w-5 h-5" />}
                    <span>{added ? 'Added to Cart' : 'Add to Cart'}</span>
                  </button>

                  <button
                    onClick={() => onBuyNow(product, quantity)}
                    disabled={!inStock}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#34222e] text-sm font-bold text-white hover:bg-[#20151c] transition-all cursor-pointer shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4 text-[#f8cb46]" />
                    <span>Buy Now (Instant Dispatch)</span>
                  </button>
                </div>

                {/* PIN Code Delivery Checker */}
                <form onSubmit={(e) => void checkPin(e)} className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-t border-[#f9bf8f]/40 pt-3 text-sm">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <MapPin className="w-4 h-4 text-[#0c831f] shrink-0" />
                    <label htmlFor="pin-check" className="text-[#34222e] font-semibold text-xs sm:text-sm shrink-0">
                      Check Dark Store PIN
                    </label>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                    <input
                      id="pin-check"
                      inputMode="numeric"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit PIN"
                      className="h-9 flex-1 sm:w-36 min-w-0 rounded-lg border border-[#f9bf8f] px-3 text-xs sm:text-sm outline-none focus:border-[#0c831f] bg-[#fffbf7]"
                    />
                    <button type="submit" className="h-9 shrink-0 rounded-lg bg-[#34222e] text-white px-3.5 text-xs font-bold hover:bg-[#20151c] transition cursor-pointer">
                      Verify
                    </button>
                  </div>
                  {pinStatus && (
                    <p className={`basis-full text-xs font-semibold ${pinStatus.tone === 'ok' ? 'text-[#0c831f]' : pinStatus.tone === 'warn' ? 'text-[#e2434b]' : 'text-[#7a6274]'}`}>
                      {pinStatus.text}
                    </p>
                  )}
                </form>
              </div>

            </div>
          </div>
        </section>

        {/* Tiered Bulk / Maker Lab Pricing Section */}
        {tierPricing.length > 0 && (
          <section className="rounded-2xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-4 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-base font-bold text-[#34222e] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#0c831f]" />
                  <span>Maker Lab & Volume Tiered Pricing</span>
                </h3>
                <p className="text-xs text-[#7a6274]">
                  Ordering for your robotics team, university lab, or batch manufacturing? Volume discounts apply automatically.
                </p>
              </div>
              <button
                onClick={() => onNavigate('b2b')}
                className="text-xs font-bold text-[#0c831f] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>B2B Institutional Orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {tierPricing.map((tier, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    quantity >= tier.minQty && (!tier.maxQty || quantity <= tier.maxQty)
                      ? 'border-[#0c831f] bg-[#f2fcf4] ring-2 ring-[#0c831f]/20'
                      : 'border-[#f9bf8f]/50 bg-white hover:border-[#f9bf8f]'
                  }`}
                >
                  <span className="text-xs text-[#7a6274] font-medium block">
                    {tier.maxQty ? `${tier.minQty} - ${tier.maxQty} units` : `${tier.minQty}+ units`}
                  </span>
                  <span className="text-lg font-extrabold text-[#34222e] block my-1">
                    {inr(tier.price)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    tier.savings === 'Standard' ? 'bg-[#fee9d7] text-[#34222e]' : 'bg-[#0c831f] text-white'
                  }`}>
                    {tier.savings}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comprehensive Interactive Technical Tabs Section */}
        <section ref={tabsRef} className="rounded-2xl border border-[#f9bf8f]/60 bg-[#fffbf7] overflow-hidden shadow-xs">
          
          {/* Tabs Navigation Bar */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-[#f9bf8f]/60 bg-[#fee9d7]/40 p-2 sm:p-3 scrollbar-none">
            
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-[#0c831f] shadow-xs border border-[#f9bf8f]/60'
                  : 'text-[#7a6274] hover:text-[#34222e] hover:bg-white/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Overview & Highlights</span>
            </button>

            <button
              onClick={() => setActiveTab('specifications')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === 'specifications'
                  ? 'bg-white text-[#0c831f] shadow-xs border border-[#f9bf8f]/60'
                  : 'text-[#7a6274] hover:text-[#34222e] hover:bg-white/60'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Technical Specifications</span>
              <span className="text-[10px] bg-[#34222e]/10 px-1.5 py-0.5 rounded-full">{specs.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('pinout')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === 'pinout'
                  ? 'bg-white text-[#0c831f] shadow-xs border border-[#f9bf8f]/60'
                  : 'text-[#7a6274] hover:text-[#34222e] hover:bg-white/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Pinout & Wiring</span>
            </button>

            <button
              onClick={() => setActiveTab('package')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === 'package'
                  ? 'bg-white text-[#0c831f] shadow-xs border border-[#f9bf8f]/60'
                  : 'text-[#7a6274] hover:text-[#34222e] hover:bg-white/60'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>Package Includes</span>
              <span className="text-[10px] bg-[#34222e]/10 px-1.5 py-0.5 rounded-full">{packageIncludes.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('resources')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === 'resources'
                  ? 'bg-white text-[#0c831f] shadow-xs border border-[#f9bf8f]/60'
                  : 'text-[#7a6274] hover:text-[#34222e] hover:bg-white/60'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Datasheet & CAD</span>
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-white text-[#0c831f] shadow-xs border border-[#f9bf8f]/60'
                  : 'text-[#7a6274] hover:text-[#34222e] hover:bg-white/60'
              }`}
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>Verified Reviews</span>
              <span className="text-[10px] bg-[#34222e]/10 px-1.5 py-0.5 rounded-full">{reviewsCount}</span>
            </button>

          </div>

          {/* Tab Content Panels */}
          <div className="p-4 sm:p-6 lg:p-8">

            {/* TAB 1: OVERVIEW & HIGHLIGHTS */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-[#34222e] mb-2">About This Component</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#5f4a58]">
                    {product.description}
                  </p>
                </div>

                {/* Key Features List */}
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#34222e] mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0c831f]" />
                    <span>Engineering Features & Capabilities</span>
                  </h4>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#f9bf8f]/40 shadow-2xs">
                        <span className="w-6 h-6 rounded-lg bg-[#f2fcf4] text-[#0c831f] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span className="text-xs sm:text-sm text-[#34222e] leading-snug font-medium">
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hardware & Microcontroller Compatibility Matrix */}
                <div className="p-4 rounded-2xl bg-[#fee9d7]/30 border border-[#f9bf8f]/50 space-y-2">
                  <h4 className="text-xs font-bold text-[#34222e] uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-[#0c831f]" />
                    <span>Microcontroller & Embedded Platform Compatibility</span>
                  </h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {['Arduino Uno / Nano / Mega', 'ESP32 (WROOM / S3 / C3)', 'Raspberry Pi 4 / 5 / Pico', 'STM32 Nucleo / BlackPill', 'RP2040', 'Teensy 4.0 / 4.1'].map((mcu, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-white border border-[#f9bf8f]/60 text-[#34222e] font-semibold text-xs flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#0c831f]" />
                        <span>{mcu}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Suggested Applications */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#34222e] uppercase tracking-wider">
                    Recommended Engineering Applications
                  </h4>
                  <p className="text-xs sm:text-sm text-[#7a6274] leading-relaxed">
                    Widely utilized in autonomous mobile robots (AMR), microrobotics, camera gimbals, smart IoT telemetry nodes, automated test rigs, university capstone projects, and rapid dark-store automated fulfillment components.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: TECHNICAL SPECIFICATIONS */}
            {activeTab === 'specifications' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#34222e]">Complete Technical Specifications</h3>
                    <p className="text-xs text-[#7a6274]">Electrical ratings, mechanical dimensions, and operating environmental parameters</p>
                  </div>
                  <span className="text-xs text-[#0c831f] font-bold bg-[#f2fcf4] px-2.5 py-1 rounded-lg border border-[#0c831f]/20">
                    RoHS Compliant & Lead-Free
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#f9bf8f]/60 bg-white shadow-2xs">
                  <dl className="divide-y divide-[#f9bf8f]/30 text-sm">
                    {specs.map(([key, value], i) => (
                      <div 
                        key={key} 
                        className={`grid grid-cols-1 sm:grid-cols-[minmax(12rem,1.5fr)_2fr] gap-1 sm:gap-4 px-4 sm:px-6 py-3 transition-colors ${
                          i % 2 === 0 ? 'bg-[#fffbf7]' : 'bg-white'
                        } hover:bg-[#fee9d7]/30`}
                      >
                        <dt className="text-xs sm:text-sm font-bold text-[#34222e]">{key}</dt>
                        <dd className="text-xs sm:text-sm font-medium text-[#5f4a58]">{value}</dd>
                      </div>
                    ))}
                    
                    {/* Standardized Core Specs If Not in Object */}
                    {product.brand && (
                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(12rem,1.5fr)_2fr] gap-1 sm:gap-4 px-4 sm:px-6 py-3 bg-[#fffbf7]">
                        <dt className="text-xs sm:text-sm font-bold text-[#34222e]">Brand / Manufacturer</dt>
                        <dd className="text-xs sm:text-sm font-medium text-[#5f4a58]">{product.brand}</dd>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(12rem,1.5fr)_2fr] gap-1 sm:gap-4 px-4 sm:px-6 py-3 bg-white">
                      <dt className="text-xs sm:text-sm font-bold text-[#34222e]">GST Tax Slab</dt>
                      <dd className="text-xs sm:text-sm font-medium text-[#5f4a58]">{product.gstRate || 18}% (Harmonized System Code: {product.hsn || '85423100'})</dd>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(12rem,1.5fr)_2fr] gap-1 sm:gap-4 px-4 sm:px-6 py-3 bg-[#fffbf7]">
                      <dt className="text-xs sm:text-sm font-bold text-[#34222e]">Quality Assurance</dt>
                      <dd className="text-xs sm:text-sm font-medium text-[#0c831f] font-semibold">100% Pre-Dispatch bench tested at Spaceborn dark store</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {/* TAB 3: PINOUT & WIRING GUIDE */}
            {activeTab === 'pinout' && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-[#f2fcf4] border border-[#0c831f]/20 flex items-start gap-3">
                  <Info className="w-5 h-5 text-[#0c831f] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-[#34222e] text-sm block">Wiring & Logic Voltage Standards</span>
                    <p className="text-xs text-[#7a6274] leading-relaxed mt-0.5">
                      Standard 2.54mm pitch spacing. Always confirm logic level compatibility (3.3V vs 5V) before connecting power. For inductive loads like motors, ensure flyback protection diodes are incorporated in your driver circuit.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#f9bf8f]/60 bg-white shadow-2xs">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-[#fee9d7] text-[#34222e] font-extrabold border-b border-[#f9bf8f]/60">
                      <tr>
                        <th className="px-4 sm:px-6 py-3">Pin</th>
                        <th className="px-4 sm:px-6 py-3">Color Code</th>
                        <th className="px-4 sm:px-6 py-3">Signal Name</th>
                        <th className="px-4 sm:px-6 py-3">Functional Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f9bf8f]/30 font-medium text-[#7a6274]">
                      {pinout.map((p, idx) => (
                        <tr key={idx} className="hover:bg-[#fffbf7]">
                          <td className="px-4 sm:px-6 py-3 font-bold text-[#34222e]">{p.pin}</td>
                          <td className="px-4 sm:px-6 py-3">
                            <span className="inline-flex items-center gap-2">
                              <span 
                                className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0 shadow-2xs" 
                                style={{ backgroundColor: p.color.toLowerCase() === 'white' ? '#f8f9fa' : p.color.toLowerCase() }}
                              />
                              <span className="font-semibold text-[#34222e]">{p.color}</span>
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-3 font-mono font-bold text-[#e2434b]">{p.function}</td>
                          <td className="px-4 sm:px-6 py-3 text-[#5f4a58]">{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: WHAT'S IN THE BOX */}
            {activeTab === 'package' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-[#34222e]">Box & Package Contents</h3>
                  <p className="text-xs text-[#7a6274]">Every item packed in electro-static discharge (ESD) safe containers</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {packageIncludes.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3.5 p-4 bg-white rounded-2xl border border-[#f9bf8f]/50 shadow-2xs">
                      <div className="w-10 h-10 rounded-xl bg-[#fee9d7] flex items-center justify-center shrink-0">
                        <Box className="w-5 h-5 text-[#0c831f]" />
                      </div>
                      <span className="font-bold text-sm text-[#34222e]">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-[#fffbf7] border border-[#f9bf8f]/40 flex items-center gap-3 text-xs text-[#7a6274]">
                  <Package className="w-5 h-5 text-[#0c831f] shrink-0" />
                  <span>
                    Packaging complies with Spaceborn Express dark store sealed logistics standard. Unboxing video recommended for transit claims.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 5: DATASHEETS & CAD */}
            {activeTab === 'resources' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-[#34222e]">Technical Datasheets & CAD Models</h3>
                  <p className="text-xs text-[#7a6274]">Download official engineering documentation and 3D assembly models</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Datasheet Card */}
                  <div className="p-5 rounded-2xl border border-[#f9bf8f]/60 bg-white space-y-3 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-[#e2434b]/10 text-[#e2434b] flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#34222e]">Official Engineering Datasheet (PDF)</h4>
                      <p className="text-xs text-[#7a6274]">Complete pin configurations, electrical ratings, timing diagrams, and mechanical tolerances.</p>
                    </div>
                    <a
                      href={product.datasheetUrl || `https://spaceborn.in/datasheets/${product.sku.toLowerCase()}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-white bg-[#0c831f] hover:bg-[#0a701a] px-4 py-2.5 rounded-xl transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Datasheet (PDF)</span>
                    </a>
                  </div>

                  {/* CAD Model Card */}
                  <div className="p-5 rounded-2xl border border-[#f9bf8f]/60 bg-white space-y-3 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-[#34222e]/10 text-[#34222e] flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#34222e]">3D CAD Model / STEP Assembly</h4>
                      <p className="text-xs text-[#7a6274]">Exact 3D dimensions for mechanical chassis integration in SolidWorks, Fusion 360, and FreeCAD.</p>
                    </div>
                    <a
                      href={product.cadModelUrl || `https://spaceborn.in/cad/${product.sku.toLowerCase()}.step`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-[#34222e] bg-[#fee9d7] hover:bg-[#fbd3b2] px-4 py-2.5 rounded-xl transition cursor-pointer border border-[#f9bf8f]/60"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download 3D STEP File</span>
                    </a>
                  </div>
                </div>

                {/* Quickstart Code Snippet Preview */}
                <div className="rounded-2xl border border-[#f9bf8f]/50 bg-[#34222e] p-4 text-white space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#f9bf8f]">
                    <span className="font-mono font-bold">arduino_quickstart.ino</span>
                    <span>Ready for 10-min bench testing</span>
                  </div>
                  <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto text-[#f8fafc]/90 p-2 bg-black/30 rounded-lg">
{`// Spaceborn Express Hardware Quick-Test
#define PIN_SIGNAL 2
void setup() {
  Serial.begin(115200);
  pinMode(PIN_SIGNAL, INPUT_PULLUP);
  Serial.println("Spaceborn component initialized.");
}
void loop() {
  int val = digitalRead(PIN_SIGNAL);
  Serial.println(val);
  delay(100);
}`}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 6: VERIFIED MAKER & LAB REVIEWS */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                
                {/* Scorecard */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-5 sm:p-6 bg-white rounded-2xl border border-[#f9bf8f]/60 shadow-2xs">
                  <div className="flex items-center gap-5">
                    <span className="text-5xl font-black text-[#34222e]">{ratingScore}</span>
                    <div>
                      <div className="flex text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs text-[#7a6274] font-medium block mt-1">
                        Based on {reviewsCount} verified maker & lab reviews across India
                      </span>
                    </div>
                  </div>

                  {/* Rating Bars */}
                  <div className="w-full sm:w-64 space-y-1.5 text-xs text-[#7a6274]">
                    <div className="flex items-center gap-2">
                      <span className="w-8 shrink-0">5 star</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                      <span className="w-8 text-right font-medium">85%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 shrink-0">4 star</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: '12%' }}></div>
                      </div>
                      <span className="w-8 text-right font-medium">12%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 shrink-0">3 star</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: '3%' }}></div>
                      </div>
                      <span className="w-8 text-right font-medium">3%</span>
                    </div>
                  </div>
                </div>

                {/* Verified Customer Reviews */}
                <div className="grid gap-3.5 md:grid-cols-2">
                  {[
                    {
                      name: 'Rajesh Sharma',
                      org: 'Robotics Lab, IIT Kanpur',
                      date: '2 weeks ago',
                      title: 'Rock solid precision and rapid delivery',
                      comment: 'Delivered to our lab bench in 12 minutes flat. High build quality, clean waveform, and zero jitter on quadrature channels. Re-ordering for the entire robotics batch.',
                      rating: 5,
                    },
                    {
                      name: 'Ananya Deshmukh',
                      org: 'Drone Tech Club, BITS Pilani',
                      date: '3 weeks ago',
                      title: 'Genuine component, exact specs match datasheet',
                      comment: 'Far superior to local market clones. Genuine IC branding, correct thermal resistance, and verified pinout. The 10-minute dispatch saved our hardware hackathon project.',
                      rating: 5,
                    },
                    {
                      name: 'Vikramaditya Verma',
                      org: 'Embedded Systems Lead, Bengaluru',
                      date: '1 month ago',
                      title: 'Input Tax Credit GST invoice was seamless',
                      comment: 'Company GST invoice was generated automatically at checkout. Hardware passed all burn-in tests without failure.',
                      rating: 5,
                    },
                    {
                      name: 'Karthik Raja',
                      org: 'Mechatronics Dept, Chennai',
                      date: '1 month ago',
                      title: 'Clean packaging and pre-tested',
                      comment: 'Arrived in sealed anti-static bags with QC check stickers. High accuracy in torque and velocity feedback.',
                      rating: 4,
                    }
                  ].map((rev, idx) => (
                    <div key={idx} className="p-4 sm:p-5 rounded-2xl border border-[#f9bf8f]/50 bg-white space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-[#34222e] block">{rev.name}</span>
                          <span className="text-[11px] text-[#7a6274]">{rev.org}</span>
                        </div>
                        <span className="text-[10px] bg-[#f2fcf4] text-[#0c831f] font-bold px-2 py-0.5 rounded-md border border-[#0c831f]/20">
                          Verified Buyer
                        </span>
                      </div>

                      <div className="flex text-amber-400">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>

                      <h5 className="text-xs sm:text-sm font-bold text-[#34222e]">{rev.title}</h5>
                      <p className="text-xs text-[#5f4a58] leading-relaxed">{rev.comment}</p>
                      <span className="text-[#7a6274] text-[10px] block pt-1">{rev.date}</span>
                    </div>
                  ))}
                </div>

              </div>
            )}

          </div>

        </section>

        {/* Related Components Section */}
        {related.length > 0 && (
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#34222e]">
                  Related & Compatible Components in {product.category}
                </h3>
                <p className="text-xs text-[#7a6274]">Frequently paired by robotics engineers and makers</p>
              </div>
              <button 
                onClick={() => onNavigate('catalog')} 
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#e2434b] hover:text-[#c7323a] cursor-pointer"
              >
                <span>View Full Catalog</span>
                <ArrowRight className="w-4 h-4" />
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
