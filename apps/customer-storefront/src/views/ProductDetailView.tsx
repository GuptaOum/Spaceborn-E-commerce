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
  ChevronRight,
  Download,
  FileText,
  Lock,
  MapPin,
  Minus,
  Plus,
  Receipt,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Zap,
  MessageSquarePlus,
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  allProducts: Product[];
  onAddToCart: (p: Product, qty: number) => void;
  onBuyNow: (p: Product, qty: number) => void;
  onSelectProduct: (p: Product) => void;
  onNavigate: (view: AppView) => void;
}

interface ReviewItem {
  name: string;
  org?: string;
  date: string;
  title: string;
  comment: string;
  rating: number;
  verified?: boolean;
}

const DEFAULT_REVIEWS: ReviewItem[] = [
  {
    name: 'Rajesh Sharma',
    org: 'Robotics Lab, IIT Kanpur',
    date: '2 weeks ago',
    title: 'Rock solid precision and rapid delivery',
    comment:
      'Delivered to our lab bench in 12 minutes flat. High build quality, clean waveform, and zero jitter on quadrature channels. Re-ordering for the entire robotics batch.',
    rating: 5,
    verified: true,
  },
  {
    name: 'Ananya Deshmukh',
    org: 'Drone Tech Club, BITS Pilani',
    date: '3 weeks ago',
    title: 'Genuine component, exact specs match datasheet',
    comment:
      'Far superior to local market clones. Genuine IC branding, correct thermal resistance, and verified pinout. The 10-minute dispatch saved our hardware hackathon project.',
    rating: 5,
    verified: true,
  },
  {
    name: 'Vikramaditya Verma',
    org: 'Embedded Systems Lead, Bengaluru',
    date: '1 month ago',
    title: 'Input Tax Credit GST invoice was seamless',
    comment:
      'Company GST invoice was generated automatically at checkout. Hardware passed all burn-in tests without failure.',
    rating: 5,
    verified: true,
  },
];

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

type TabKey = 'description' | 'documents' | 'reviews';

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
  const [activeTab, setActiveTab] = useState<TabKey>('description');

  // Review System State
  const [reviews, setReviews] = useState<ReviewItem[]>(DEFAULT_REVIEWS);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Hover zoom: where the cursor is over the image, as percentages
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
    setActiveTab('description');
    setShowReviewForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load persisted reviews
    try {
      const stored = localStorage.getItem(`spaceborn_reviews_${product.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as ReviewItem[];
        setReviews([...parsed, ...DEFAULT_REVIEWS]);
      } else {
        setReviews(DEFAULT_REVIEWS);
      }
    } catch {
      setReviews(DEFAULT_REVIEWS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= 5;
  const total = product.price * quantity;
  const spillsOver = product.nearestStock !== undefined && quantity > product.nearestStock;
  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  const specs = Object.entries(product.specifications ?? {});
  const badges = product.badges && product.badges.length > 0 ? product.badges : product.isChoice ? (['our_pick'] as const) : [];
  const related = allProducts.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);

  const features =
    product.features && product.features.length > 0
      ? product.features
      : [
          'Industrial-grade electronic component with high thermal stability',
          'Standard 2.54mm breadboard & perfboard compatible header pitch',
          'Low power consumption optimized for embedded and battery operations',
          'Pre-tested and ESD safe packaged for immediate lab workbench deployment',
        ];

  const packageIncludes =
    product.packageIncludes && product.packageIncludes.length > 0
      ? product.packageIncludes
      : [
          `1 x ${product.name}`,
          '1 x Anti-Static ESD Protective Shield Bag',
          '1 x Spaceborn QC Verification Certificate',
        ];

  const totalReviewsCount = reviews.length;
  const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / (totalReviewsCount || 1)).toFixed(1);

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
      /* clipboard blocked */
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
          ? {
              tone: 'ok',
              text: `Delivers to ${pincode} in about ${offer.etaMinutes} min. ${offer.nearbyStock ?? offer.stock} in stock at nearest dark store.`,
            }
          : { tone: 'warn', text: `This item is listed near ${pincode} but is currently out of stock.` },
      );
    } catch {
      setPinStatus({ tone: 'warn', text: `This item is not available near ${pincode} yet.` });
    }
  };

  const scrollToReviews = (openForm = false) => {
    setActiveTab('reviews');
    if (openForm) setShowReviewForm(true);
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !newTitle.trim()) return;

    const newRev: ReviewItem = {
      name: newName.trim() || 'Verified Maker',
      org: newOrg.trim() || 'Robotics & Hardware Lab',
      date: 'Just now',
      title: newTitle.trim(),
      comment: newComment.trim(),
      rating: newRating,
      verified: true,
    };

    const updated = [newRev, ...reviews];
    setReviews(updated);

    try {
      const userAdded = updated.filter((r) => r.date === 'Just now' || !DEFAULT_REVIEWS.some((d) => d.title === r.title));
      localStorage.setItem(`spaceborn_reviews_${product.id}`, JSON.stringify(userAdded));
    } catch {
      /* ignore storage write error */
    }

    setReviewSubmitted(true);
    setTimeout(() => {
      setReviewSubmitted(false);
      setShowReviewForm(false);
      setNewTitle('');
      setNewComment('');
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-3 sm:py-6">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 space-y-4 sm:space-y-6">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-3 text-xs text-[#7a6274]">
          <ol className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
            <li>
              <button onClick={() => onNavigate('home')} className="hover:text-[#34222e] cursor-pointer">
                Home
              </button>
            </li>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <li>
              <button onClick={() => onNavigate('catalog')} className="hover:text-[#34222e] cursor-pointer">
                {product.category}
              </button>
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

        {/* Main Product Hero (Robu-Style Two Column Layout) */}
        <section className="rounded-2xl border border-[#f9bf8f]/60 bg-[#fffbf7] p-4 sm:p-6 lg:p-7 shadow-xs">
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
            {/* Left: Gallery & Trust Highlights */}
            <div className="lg:col-span-5 space-y-3.5 lg:sticky lg:top-24 self-start">
              <div
                className="relative flex h-72 sm:h-88 items-center justify-center overflow-hidden rounded-2xl border border-[#f9bf8f]/50 bg-white p-4 lg:cursor-zoom-in shadow-2xs"
                onMouseMove={trackZoom}
                onMouseLeave={() => setZoomAt(null)}
              >
                <img
                  src={selectedImage}
                  alt={product.name}
                  draggable={false}
                  className={`max-h-full max-w-full select-none object-contain ${
                    zoomAt ? '' : 'transition-transform duration-200 ease-out'
                  }`}
                  style={{
                    transform: zoomAt ? `scale(${ZOOM})` : 'scale(1)',
                    transformOrigin: zoomAt ? `${zoomAt.x}% ${zoomAt.y}%` : 'center',
                  }}
                />

                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-[#f2fcf4] text-[#0c831f] text-[10px] font-bold border border-[#0c831f]/20 flex items-center gap-1 shadow-2xs">
                  <Zap className="w-3 h-3 fill-[#0c831f]" />
                  <span>{product.deliveryMins || 10} MIN DISPATCH</span>
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
                        selectedImage === img
                          ? 'border-[#0c831f] ring-2 ring-[#0c831f]/20'
                          : 'border-[#f9bf8f]/50 hover:border-[#0c831f]/50'
                      }`}
                    >
                      <img src={img} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}

              {/* Clean Trust Strip */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-[#f9bf8f]/50 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <span className="font-semibold text-[#34222e] text-[11px]">100% Genuine</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#f9bf8f]/50 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <span className="font-semibold text-[#34222e] text-[11px]">GST Invoice Available</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#f9bf8f]/50 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <span className="font-semibold text-[#34222e] text-[11px]">10-15 Min Delivery</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#f9bf8f]/50 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-[#0c831f] shrink-0" />
                  <span className="font-semibold text-[#34222e] text-[11px]">7-Day Replacement</span>
                </div>
              </div>
            </div>

            {/* Right: Product Details & Purchase Box */}
            <div className="lg:col-span-7 space-y-4">
              {/* Product Header */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a6274]">
                  {product.brand && (
                    <span className="font-bold text-[#0c831f] bg-[#f2fcf4] px-2 py-0.5 rounded-md border border-[#0c831f]/20">
                      Brand: {product.brand}
                    </span>
                  )}
                  <span className="font-mono">SKU: {product.sku}</span>
                  {product.hsn && <span>| HSN: {product.hsn}</span>}
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-bold leading-snug text-[#34222e]">
                  {product.name}
                </h1>

                {/* Rating Bar */}
                <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                  <button
                    onClick={() => scrollToReviews(false)}
                    className="flex items-center gap-1.5 cursor-pointer group"
                    title="View verified reviews"
                  >
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.floor(Number(avgRating)) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-[#34222e]">{avgRating}</span>
                    <span className="text-xs text-[#7a6274] group-hover:text-[#0c831f] group-hover:underline">
                      ({totalReviewsCount} Reviews)
                    </span>
                  </button>

                  <button
                    onClick={() => scrollToReviews(true)}
                    className="text-xs font-bold text-[#0c831f] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>Write a review</span>
                  </button>

                  {badges.map((b) => (
                    <span
                      key={b}
                      title={PRODUCT_BADGES[b]?.hint}
                      className="inline-flex items-center gap-1 rounded-md bg-[#34222e] px-2 py-0.5 text-[11px] font-semibold text-white"
                    >
                      <BadgeCheck className="w-3 h-3 text-[#f8cb46]" />
                      {PRODUCT_BADGES[b]?.label ?? b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price & GST */}
              <div className="space-y-1 rounded-xl bg-white border border-[#f9bf8f]/60 p-3 sm:p-4">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="text-2xl sm:text-3xl font-black text-[#34222e] tracking-tight">
                    {inr(product.price)}
                  </span>
                  {discount > 0 && product.originalPrice && (
                    <>
                      <span className="text-sm text-[#7a6274] line-through font-medium">
                        MRP {inr(product.originalPrice)}
                      </span>
                      <span className="rounded-md bg-[#0c831f] px-1.5 py-0.5 text-xs font-bold text-white">
                        {discount}% OFF
                      </span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a6274]">
                  <span>(Incl. of all taxes / {product.gstRate || 18}% GST)</span>
                  <span>•</span>
                  {inStock ? (
                    <span className={`font-bold ${lowStock ? 'text-[#e2434b]' : 'text-[#0c831f]'}`}>
                      {lowStock
                        ? `Only ${product.stock} units left in dark store`
                        : `✓ In stock (${product.stock} units available)`}
                    </span>
                  ) : (
                    <span className="font-bold text-[#e2434b]">Out of stock</span>
                  )}
                </div>
              </div>

              {/* Key Features Bullets (Robu-style concise highlights) */}
              <div className="space-y-1.5 py-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#34222e]">Key Features:</h3>
                <ul className="space-y-1 text-xs text-[#5f4a58]">
                  {features.slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#0c831f] font-bold shrink-0 mt-0.5">•</span>
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Optional Tier Pricing (Compact & Clean Robu-style wholesale strip) */}
              {product.tierPricing && product.tierPricing.length > 0 && (
                <div className="rounded-xl border border-[#f9bf8f]/60 bg-[#fee9d7]/30 p-2.5 text-xs">
                  <div className="font-semibold text-[#34222e] mb-1.5 flex items-center justify-between">
                    <span>Bulk / Maker Lab Pricing</span>
                    <span className="text-[10px] text-[#0c831f] font-bold">Auto-applied in cart</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                    {product.tierPricing.map((tier, idx) => (
                      <div
                        key={idx}
                        className={`p-1.5 rounded-lg border text-xs ${
                          quantity >= tier.minQty && (!tier.maxQty || quantity <= tier.maxQty)
                            ? 'border-[#0c831f] bg-[#f2fcf4] font-bold ring-1 ring-[#0c831f]/30'
                            : 'border-[#f9bf8f]/50 bg-white'
                        }`}
                      >
                        <div className="text-[10px] text-[#7a6274]">
                          {tier.maxQty ? `${tier.minQty}-${tier.maxQty} pcs` : `${tier.minQty}+ pcs`}
                        </div>
                        <div className="font-extrabold text-[#34222e]">{inr(tier.price)}</div>
                        <div className="text-[9px] text-[#0c831f]">{tier.savings}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Stepper & Action Buttons */}
              <div className="space-y-3 rounded-2xl border border-[#f9bf8f]/60 bg-white p-3.5 sm:p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-xl border border-[#f9bf8f] bg-[#fffbf7]">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty(quantity - 1)}
                      disabled={!inStock || quantity <= 1}
                      className="flex h-9 w-9 items-center justify-center hover:bg-[#fee9d7] disabled:opacity-40 cursor-pointer transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5 text-[#34222e]" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                      disabled={!inStock}
                      className="h-9 w-12 border-x border-[#f9bf8f] bg-white text-center text-xs font-bold text-[#34222e] outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQty(quantity + 1)}
                      disabled={!inStock || quantity >= product.stock}
                      className="flex h-9 w-9 items-center justify-center hover:bg-[#fee9d7] disabled:opacity-40 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#34222e]" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-[#7a6274] block">Subtotal</span>
                    <span className="text-lg sm:text-xl font-black text-[#34222e]">{inr(total)}</span>
                  </div>
                </div>

                {spillsOver && (
                  <p className="text-[11px] text-[#7a6274] bg-[#fee9d7]/50 p-2 rounded-lg border border-[#f9bf8f]/40">
                    ℹ️ {product.nearestStock} units available at nearest dark store. Additional units pooled from adjacent hub.
                  </p>
                )}

                <div className="grid gap-2 sm:grid-cols-2 pt-1">
                  <button
                    onClick={handleAdd}
                    disabled={!inStock}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                      added ? 'bg-[#0a701a]' : 'bg-[#0c831f] hover:bg-[#0a701a]'
                    }`}
                  >
                    {added ? <Check className="w-4 h-4 stroke-[2.5]" /> : <ShoppingCart className="w-4 h-4" />}
                    <span>{added ? 'Added to Cart' : 'Add to Cart'}</span>
                  </button>

                  <button
                    onClick={() => onBuyNow(product, quantity)}
                    disabled={!inStock}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#34222e] text-xs font-bold text-white hover:bg-[#20151c] transition-all cursor-pointer shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#f8cb46]" />
                    <span>Buy Now</span>
                  </button>
                </div>

                {/* Delivery PIN Code Checker */}
                <form
                  onSubmit={(e) => void checkPin(e)}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-t border-[#f9bf8f]/40 pt-2.5 text-xs"
                >
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <MapPin className="w-3.5 h-3.5 text-[#0c831f] shrink-0" />
                    <label htmlFor="pin-check" className="text-[#34222e] font-semibold shrink-0">
                      Delivery to:
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto flex-1">
                    <input
                      id="pin-check"
                      inputMode="numeric"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit PIN"
                      className="h-8 flex-1 sm:w-32 min-w-0 rounded-lg border border-[#f9bf8f] px-2.5 text-xs outline-none focus:border-[#0c831f] bg-[#fffbf7]"
                    />
                    <button
                      type="submit"
                      className="h-8 shrink-0 rounded-lg bg-[#34222e] text-white px-3 text-xs font-bold hover:bg-[#20151c] transition cursor-pointer"
                    >
                      Check
                    </button>
                  </div>
                  {pinStatus && (
                    <p
                      className={`basis-full text-xs font-semibold ${
                        pinStatus.tone === 'ok'
                          ? 'text-[#0c831f]'
                          : pinStatus.tone === 'warn'
                          ? 'text-[#e2434b]'
                          : 'text-[#7a6274]'
                      }`}
                    >
                      {pinStatus.text}
                    </p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Clean 3-Tab Section (Robu.in Standard: Description, Documents, Reviews) */}
        <section ref={tabsRef} className="rounded-2xl border border-[#f9bf8f]/60 bg-[#fffbf7] overflow-hidden shadow-xs">
          {/* Tab Navigation Bar */}
          <div className="flex items-center gap-1 border-b border-[#f9bf8f]/60 bg-[#fee9d7]/40 px-3 pt-2">
            <button
              onClick={() => setActiveTab('description')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-t border-x cursor-pointer transition-colors ${
                activeTab === 'description'
                  ? 'bg-[#fffbf7] border-[#f9bf8f]/60 text-[#0c831f] -mb-px'
                  : 'border-transparent text-[#7a6274] hover:text-[#34222e]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Description</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-t border-x cursor-pointer transition-colors ${
                activeTab === 'documents'
                  ? 'bg-[#fffbf7] border-[#f9bf8f]/60 text-[#0c831f] -mb-px'
                  : 'border-transparent text-[#7a6274] hover:text-[#34222e]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Documents</span>
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-t border-x cursor-pointer transition-colors ${
                activeTab === 'reviews'
                  ? 'bg-[#fffbf7] border-[#f9bf8f]/60 text-[#0c831f] -mb-px'
                  : 'border-transparent text-[#7a6274] hover:text-[#34222e]'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Reviews ({totalReviewsCount})</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="p-4 sm:p-6 lg:p-7">
            {/* TAB 1: DESCRIPTION (Overview, Features, Specifications Table, Package Includes) */}
            {activeTab === 'description' && (
              <div className="space-y-6">
                {/* Product Overview Narrative */}
                <div>
                  <h3 className="text-sm font-bold text-[#34222e] uppercase tracking-wider mb-2">Product Overview</h3>
                  <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-[#5f4a58]">
                    {product.description ||
                      `${product.name} is a high-grade electronic component engineered for robotics, embedded systems, and maker prototyping. Tested for high performance and stability across demanding operating conditions.`}
                  </p>
                </div>

                {/* Features List */}
                <div>
                  <h3 className="text-sm font-bold text-[#34222e] uppercase tracking-wider mb-2.5">Features:</h3>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-[#5f4a58]">
                    {features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#0c831f] font-bold shrink-0 mt-0.5">•</span>
                        <span className="leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Specifications Table (Robu Two-Column Clean Striped Table) */}
                <div>
                  <h3 className="text-sm font-bold text-[#34222e] uppercase tracking-wider mb-2.5">Specifications:</h3>
                  <div className="overflow-hidden rounded-xl border border-[#f9bf8f]/60 bg-white">
                    <table className="w-full text-xs sm:text-sm text-left">
                      <thead className="bg-[#fee9d7] text-[#34222e] font-bold border-b border-[#f9bf8f]/60">
                        <tr>
                          <th className="px-4 py-2.5 w-1/3">Specification</th>
                          <th className="px-4 py-2.5">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f9bf8f]/30">
                        {specs.map(([key, value], i) => (
                          <tr key={key} className={i % 2 === 0 ? 'bg-[#fffbf7]' : 'bg-white'}>
                            <td className="px-4 py-2.5 font-bold text-[#34222e]">{key}</td>
                            <td className="px-4 py-2.5 text-[#5f4a58]">{value}</td>
                          </tr>
                        ))}
                        {product.brand && (
                          <tr className={specs.length % 2 === 0 ? 'bg-[#fffbf7]' : 'bg-white'}>
                            <td className="px-4 py-2.5 font-bold text-[#34222e]">Brand / Manufacturer</td>
                            <td className="px-4 py-2.5 text-[#5f4a58]">{product.brand}</td>
                          </tr>
                        )}
                        <tr className={(specs.length + 1) % 2 === 0 ? 'bg-[#fffbf7]' : 'bg-white'}>
                          <td className="px-4 py-2.5 font-bold text-[#34222e]">HSN Code</td>
                          <td className="px-4 py-2.5 text-[#5f4a58]">{product.hsn || '85423100'}</td>
                        </tr>
                        <tr className={(specs.length + 2) % 2 === 0 ? 'bg-[#fffbf7]' : 'bg-white'}>
                          <td className="px-4 py-2.5 font-bold text-[#34222e]">Tax Slab</td>
                          <td className="px-4 py-2.5 text-[#5f4a58]">{product.gstRate || 18}% GST</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Package Includes */}
                <div>
                  <h3 className="text-sm font-bold text-[#34222e] uppercase tracking-wider mb-2.5">Package Includes:</h3>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-[#5f4a58]">
                    {packageIncludes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#0c831f] font-bold shrink-0 mt-0.5">•</span>
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 2: DOCUMENTS (Datasheet & Pinout Reference) */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-[#34222e] uppercase tracking-wider mb-1">
                    Attachments & Datasheets
                  </h3>
                  <p className="text-xs text-[#7a6274]">Download official engineering documentation and pin diagrams.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={product.datasheetUrl || `https://spaceborn.in/datasheets/${product.sku.toLowerCase()}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-white bg-[#0c831f] hover:bg-[#0a701a] px-4 py-2.5 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Datasheet (PDF)</span>
                  </a>

                  {product.cadModelUrl && (
                    <a
                      href={product.cadModelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-[#34222e] bg-[#fee9d7] hover:bg-[#fbd3b2] px-4 py-2.5 rounded-xl transition cursor-pointer border border-[#f9bf8f]/60"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download 3D CAD (STEP)</span>
                    </a>
                  )}
                </div>

                {/* Pinout Table if available */}
                {product.pinout && product.pinout.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-[#34222e] uppercase tracking-wider">Pin Configuration</h4>
                    <div className="overflow-hidden rounded-xl border border-[#f9bf8f]/60 bg-white">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#fee9d7] text-[#34222e] font-bold border-b border-[#f9bf8f]/60">
                          <tr>
                            <th className="px-4 py-2.5">Pin</th>
                            <th className="px-4 py-2.5">Color</th>
                            <th className="px-4 py-2.5">Signal</th>
                            <th className="px-4 py-2.5">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f9bf8f]/30 text-[#5f4a58]">
                          {product.pinout.map((p, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-[#fffbf7]' : 'bg-white'}>
                              <td className="px-4 py-2.5 font-bold text-[#34222e]">{p.pin}</td>
                              <td className="px-4 py-2.5">{p.color}</td>
                              <td className="px-4 py-2.5 font-mono font-bold text-[#0c831f]">{p.function}</td>
                              <td className="px-4 py-2.5">{p.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: REVIEWS WITH CUSTOMER SUBMISSION */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-[#f9bf8f]/60">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-black text-[#34222e]">{avgRating}</span>
                    <div>
                      <div className="flex text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < Math.floor(Number(avgRating)) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <span className="text-xs text-[#7a6274] font-medium block mt-0.5">
                        Based on {totalReviewsCount} maker & customer reviews
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0c831f] hover:bg-[#0a701a] text-white px-4 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                    <span>{showReviewForm ? 'Close Review Form' : 'Write a Review'}</span>
                  </button>
                </div>

                {/* Review Submission Form */}
                {showReviewForm && (
                  <form onSubmit={handleReviewSubmit} className="p-4 sm:p-6 bg-white rounded-2xl border border-[#0c831f]/30 shadow-xs space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-[#f9bf8f]/40 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-[#34222e]">Write a Customer Review</h4>
                        <p className="text-xs text-[#7a6274]">Share your real bench-testing, lab results, and feedback with makers across India.</p>
                      </div>
                      <span className="text-[10px] font-bold bg-[#f2fcf4] text-[#0c831f] border border-[#0c831f]/20 px-2 py-0.5 rounded-full">
                        ✓ Verified Purchaser
                      </span>
                    </div>

                    {reviewSubmitted && (
                      <div className="p-3 bg-[#f2fcf4] text-[#0c831f] border border-[#0c831f]/20 rounded-xl text-xs font-bold flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Thank you! Your verified maker review has been posted.</span>
                      </div>
                    )}

                    {/* Star Rating Picker */}
                    <div>
                      <label className="text-xs font-bold text-[#34222e] block mb-1.5">Rating (1 to 5 Stars):</label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 cursor-pointer transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-6 h-6 ${
                                star <= (hoverRating || newRating)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-xs font-semibold text-[#7a6274]">
                          {hoverRating || newRating} / 5 Stars
                        </span>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-[#34222e] block mb-1">Your Name:</label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full h-9 rounded-xl border border-[#f9bf8f]/70 px-3 text-xs outline-none focus:border-[#0c831f] bg-[#fffbf7]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#34222e] block mb-1">Lab / College / Org (Optional):</label>
                        <input
                          type="text"
                          value={newOrg}
                          onChange={(e) => setNewOrg(e.target.value)}
                          placeholder="e.g. Robotics Club, IIT Bombay"
                          className="w-full h-9 rounded-xl border border-[#f9bf8f]/70 px-3 text-xs outline-none focus:border-[#0c831f] bg-[#fffbf7]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#34222e] block mb-1">Review Headline / Title:</label>
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Solid build quality, exact specs as documented"
                        className="w-full h-9 rounded-xl border border-[#f9bf8f]/70 px-3 text-xs outline-none focus:border-[#0c831f] bg-[#fffbf7]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#34222e] block mb-1">Review Comment & Bench Test Findings:</label>
                      <textarea
                        required
                        rows={3}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Tell other makers how this component performed in your circuit or mechanical chassis..."
                        className="w-full rounded-xl border border-[#f9bf8f]/70 p-3 text-xs outline-none focus:border-[#0c831f] bg-[#fffbf7]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowReviewForm(false)}
                        className="px-4 py-2 text-xs font-semibold text-[#7a6274] hover:text-[#34222e] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 text-xs font-bold text-white bg-[#0c831f] hover:bg-[#0a701a] rounded-xl transition cursor-pointer shadow-xs"
                      >
                        Submit Verified Review
                      </button>
                    </div>
                  </form>
                )}

                {/* Reviews List */}
                <div className="space-y-3">
                  {reviews.map((rev, idx) => (
                    <div key={idx} className="p-3.5 sm:p-4 rounded-xl border border-[#f9bf8f]/50 bg-white space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-[#34222e]">{rev.name}</span>
                          {rev.org && <span className="text-[11px] text-[#7a6274] ml-2">({rev.org})</span>}
                        </div>
                        {rev.verified && (
                          <span className="text-[10px] bg-[#f2fcf4] text-[#0c831f] font-bold px-2 py-0.5 rounded-md border border-[#0c831f]/20">
                            Verified Buyer
                          </span>
                        )}
                      </div>
                      <div className="flex text-amber-400">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <h5 className="text-xs font-bold text-[#34222e]">{rev.title}</h5>
                      <p className="text-xs text-[#5f4a58] leading-relaxed">{rev.comment}</p>
                      <span className="text-[#7a6274] text-[10px] block pt-0.5">{rev.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Related Products */}
        {related.length > 0 && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#34222e]">Related Products</h3>
                <p className="text-xs text-[#7a6274]">Frequently bought together in {product.category}</p>
              </div>
              <button
                onClick={() => onNavigate('catalog')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0c831f] hover:underline cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onSelect={onSelectProduct}
                  onAddToCart={(prod, qty) => onAddToCart(prod, qty || 1)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
