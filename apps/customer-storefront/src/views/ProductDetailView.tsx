'use client';

import React, { useState, useEffect } from 'react';
import { Product, AppView } from '../types';
import { ProductCard } from '../components/ProductCard';
import { 
  Star, 
  ShoppingCart, 
  Check, 
  Truck, 
  ShieldCheck, 
  FileText, 
  Box, 
  ChevronRight, 
  Zap, 
  Lock, 
  Info, 
  MapPin, 
  CheckCircle2, 
  ZoomIn,
  RotateCcw,
  Receipt,
  Sparkles,
  ArrowRight,
  Share2,
  Heart
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  allProducts: Product[];
  onAddToCart: (p: Product, qty: number) => void;
  onBuyNow: (p: Product, qty: number) => void;
  onSelectProduct: (p: Product) => void;
  onNavigate: (view: AppView) => void;
}

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
  const [activeTab, setActiveTab] = useState<'specs' | 'pinout' | 'package' | 'reviews'>('specs');
  const [pincode, setPincode] = useState('208001');
  const [pincodeStatus, setPincodeStatus] = useState<string | null>('⚡ 10-15 Min Express Delivery available to Kanpur & Bengaluru Tech Hubs.');
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync selectedImage if product changes
  useEffect(() => {
    const pImages = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];
    setSelectedImage(pImages[0]);
    setQuantity(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product.id]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  // Calculate tier pricing if applicable
  const getUnitPriceForQty = (qty: number): number => {
    if (!product.tierPricing || product.tierPricing.length === 0) return product.price;
    for (let i = product.tierPricing.length - 1; i >= 0; i--) {
      const tier = product.tierPricing[i];
      if (qty >= tier.minQty) {
        return tier.price;
      }
    }
    return product.price;
  };

  const currentUnitPrice = getUnitPriceForQty(quantity);
  const totalPrice = currentUnitPrice * quantity;
  const priceExGst = (currentUnitPrice / 1.18).toFixed(2);
  const itcSaving = (currentUnitPrice - parseFloat(priceExGst)).toFixed(2);
  const discountPercent = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) 
    : 0;

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.length === 6) {
      setPincodeStatus(`⚡ Verified: Express runner dispatch active for PIN ${pincode}. ETA: 10-15 minutes.`);
    } else {
      setPincodeStatus('Please enter a valid 6-digit Indian PIN code.');
    }
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2000);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Related products
  const relatedProducts = allProducts.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Breadcrumb Navigation Bar */}
        <nav aria-label="Breadcrumb" className="flex items-center justify-between text-xs text-[#7a6274] mb-6">
          <div className="flex items-center space-x-2 overflow-x-auto whitespace-nowrap py-1">
            <span 
              onClick={() => onNavigate('home')} 
              className="hover:text-[#e2434b] font-medium transition cursor-pointer"
            >
              Home
            </span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#7a6274]/60" />
            <span 
              onClick={() => onNavigate('catalog')} 
              className="hover:text-[#e2434b] font-medium transition cursor-pointer"
            >
              {product.category}
            </span>
            {product.subCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#7a6274]/60" />
                <span 
                  onClick={() => onNavigate('catalog')} 
                  className="hover:text-[#e2434b] font-medium transition cursor-pointer"
                >
                  {product.subCategory}
                </span>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#7a6274]/60" />
            <span className="font-bold text-[#34222e] truncate max-w-xs sm:max-w-md">
              {product.name}
            </span>
          </div>

          <button
            onClick={handleShare}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#f9bf8f]/60 bg-[#fffbf7] text-[#7a6274] hover:text-[#34222e] text-xs font-semibold transition cursor-pointer"
            title="Share Component Link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
          </button>
        </nav>

        {/* Main Product Showcase Card */}
        <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-6 sm:p-8 lg:p-10 shadow-xs mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* Gallery Column (5 cols) */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
              
              {/* Primary Image Stage with High-Precision Zoom Lens */}
              <div 
                onMouseEnter={() => setIsZoomed(true)}
                onMouseLeave={() => setIsZoomed(false)}
                onMouseMove={handleMouseMove}
                className="relative bg-white border border-[#f9bf8f]/60 rounded-3xl p-6 sm:p-8 flex items-center justify-center h-80 sm:h-[420px] overflow-hidden group shadow-xs cursor-crosshair select-none"
              >
                <img
                  src={selectedImage}
                  alt={product.name}
                  style={{
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    transform: isZoomed ? 'scale(2.4)' : 'scale(1)',
                    transition: isZoomed ? 'transform 0.08s ease-out' : 'transform 0.3s ease-out',
                  }}
                  className="max-h-[340px] max-w-full object-contain pointer-events-none will-change-transform drop-shadow-xs"
                />
                
                {/* Delivery & Stock Badges */}
                <div className={`absolute top-4 left-4 flex flex-col gap-1.5 transition-opacity ${isZoomed ? 'opacity-0' : 'opacity-100'}`}>
                  <span className="inline-flex items-center gap-1 bg-[#f2fcf4] text-[#0c831f] text-[11px] font-bold px-2.5 py-1 rounded-xl border border-[#0c831f]/20 uppercase tracking-wide shadow-2xs">
                    <Zap className="w-3 h-3 fill-[#0c831f]" />
                    {product.deliveryMins || 10} Mins Delivery
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/95 text-[#34222e] text-[11px] font-bold px-2.5 py-1 rounded-xl border border-[#f9bf8f]/60 uppercase tracking-wide shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-[#0c831f] animate-pulse" />
                    In Stock ({product.stock} units)
                  </span>
                </div>

                {/* Hover to Zoom Lens Guide */}
                <div className={`absolute bottom-4 right-4 bg-white/95 backdrop-blur-xs text-[#7a6274] border border-[#f9bf8f]/60 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-opacity duration-200 pointer-events-none ${isZoomed ? 'opacity-0' : 'opacity-80 group-hover:opacity-100'}`}>
                  <ZoomIn className="w-3.5 h-3.5 text-[#0c831f]" />
                  <span>Roll over to zoom</span>
                </div>
              </div>

              {/* Thumbnails Carousel */}
              {images.length > 1 && (
                <div className="flex items-center space-x-3 overflow-x-auto pb-1 no-scrollbar">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(img)}
                      className={`w-20 h-20 rounded-2xl border p-1.5 bg-white shrink-0 overflow-hidden cursor-pointer transition-all ${
                        selectedImage === img 
                          ? 'border-[#0c831f] ring-2 ring-[#0c831f]/25 shadow-xs scale-102' 
                          : 'border-[#f9bf8f]/50 opacity-75 hover:opacity-100 hover:border-[#0c831f]/60'
                      }`}
                    >
                      <img src={img} alt={`thumb-${i}`} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}

              {/* Engineering Downloads Bar */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5 text-xs">
                <a
                  href="#specs"
                  onClick={(e) => { e.preventDefault(); setActiveTab('specs'); }}
                  className="w-full sm:flex-1 bg-white hover:bg-[#fee9d7]/60 text-[#34222e] font-bold py-2.5 px-3.5 rounded-2xl border border-[#f9bf8f]/60 flex items-center justify-center space-x-2 transition cursor-pointer shadow-2xs"
                >
                  <FileText className="w-4 h-4 text-[#e2434b]" />
                  <span>Datasheet (PDF)</span>
                </a>

                <a
                  href="#specs"
                  onClick={(e) => { e.preventDefault(); alert('3D CAD Step Model download initiated.'); }}
                  className="w-full sm:flex-1 bg-white hover:bg-[#fee9d7]/60 text-[#34222e] font-bold py-2.5 px-3.5 rounded-2xl border border-[#f9bf8f]/60 flex items-center justify-center space-x-2 transition cursor-pointer shadow-2xs"
                >
                  <Box className="w-4 h-4 text-[#0c831f]" />
                  <span>3D CAD (.STEP)</span>
                </a>
              </div>
            </div>

            {/* Product Configuration & Information (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Brand, SKU & Title Header */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs text-[#7a6274] gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-[#e2434b] uppercase tracking-wider bg-[#e2434b]/10 px-2.5 py-0.5 rounded-lg border border-[#e2434b]/20">
                      {product.brand}
                    </span>
                    <span>•</span>
                    <span>SKU: <strong className="text-[#34222e] font-mono">{product.sku}</strong></span>
                  </div>
                  <span className="bg-white border border-[#f9bf8f]/60 px-2.5 py-0.5 rounded-lg text-[11px] font-bold text-[#34222e]">
                    HSN: {product.hsn}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#34222e] leading-snug tracking-tight">
                  {product.name}
                </h1>

                {/* Rating & Authenticity Strip */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <div className="flex items-center space-x-1.5 bg-[#fef3c7] px-2.5 py-1 rounded-xl border border-amber-300">
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < Math.floor(product.rating) ? 'fill-amber-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                    <span className="font-extrabold text-[#34222e]">{product.rating}</span>
                    <span className="text-[#7a6274]">({product.reviewsCount})</span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-[#0c831f] font-bold bg-[#f2fcf4] px-3 py-1 rounded-xl border border-[#0c831f]/20">
                    <ShieldCheck className="w-4 h-4 text-[#0c831f]" />
                    <span>100% Genuine Certified</span>
                  </span>
                </div>
              </div>

              {/* Price & Tax Breakdown Card */}
              <div className="bg-[#fee9d7]/50 rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 space-y-3">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-black text-[#34222e] tracking-tight">
                    ₹{currentUnitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  {product.originalPrice && (
                    <span className="text-base text-[#7a6274] line-through font-semibold">
                      ₹{product.originalPrice}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-xs font-black text-[#0c831f] bg-[#f2fcf4] px-2.5 py-0.5 rounded-lg border border-[#0c831f]/20">
                      {discountPercent}% OFF
                    </span>
                  )}
                  <span className="text-xs font-bold text-[#0c831f] bg-[#f2fcf4] px-2.5 py-0.5 rounded-lg border border-[#0c831f]/20">
                    Inclusive of 18% GST
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-[#7a6274] pt-2 border-t border-[#f9bf8f]/40 gap-2">
                  <span>
                    Excl. GST: <strong className="text-[#34222e]">₹{priceExGst}</strong>
                  </span>
                  <span className="text-[#0c831f] font-bold bg-[#f2fcf4] px-2.5 py-1 rounded-xl border border-[#0c831f]/20 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-[#0c831f]" />
                    <span>B2B Tax Credit: Claim ₹{itcSaving} ITC</span>
                  </span>
                </div>
              </div>

              {/* Wholesale Volume Tiers (if applicable) */}
              {product.tierPricing && product.tierPricing.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#34222e] flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 text-[#0c831f]" />
                      <span>Volume Wholesale Tiers (Applied Automatically)</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#7a6274]">Click tier to select</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                    {product.tierPricing.map((tier, idx) => {
                      const isSelected = quantity >= tier.minQty && (!tier.maxQty || quantity <= tier.maxQty);
                      return (
                        <div
                          key={idx}
                          onClick={() => setQuantity(tier.minQty)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-[#f2fcf4] border-[#0c831f] ring-2 ring-[#0c831f]/25 shadow-xs scale-102' 
                              : 'bg-white border-[#f9bf8f]/60 hover:bg-[#fee9d7]/40 hover:border-[#0c831f]/40'
                          }`}
                        >
                          <span className="block text-[11px] font-bold text-[#7a6274]">
                            {tier.minQty}{tier.maxQty ? ` - ${tier.maxQty} pcs` : '+ pcs'}
                          </span>
                          <span className="block text-base font-black text-[#34222e] mt-0.5">
                            ₹{tier.price}
                          </span>
                          <span className={`block text-[10px] font-extrabold mt-1 ${isSelected ? 'text-[#0c831f]' : 'text-[#7a6274]'}`}>
                            {tier.savings}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dedicated Buy Box Action Controls */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-4">
                
                {/* Quantity Selection Area */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-[#34222e]">
                    Select Quantity:
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Stepper */}
                    <div className="flex items-center border-2 border-[#f9bf8f] rounded-2xl overflow-hidden bg-white shadow-xs">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-12 h-12 flex items-center justify-center text-[#34222e] hover:bg-[#fee9d7] font-black text-lg transition cursor-pointer select-none active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={product.stock}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                        className="w-16 h-12 text-center text-base font-extrabold text-[#34222e] bg-white border-x-2 border-[#f9bf8f] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                        className="w-12 h-12 flex items-center justify-center text-[#34222e] hover:bg-[#fee9d7] font-black text-lg transition cursor-pointer select-none active:scale-95"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick Pack Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 5, 10, 25, 50].map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuantity(Math.min(product.stock, q))}
                          className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                            quantity === q
                              ? 'bg-[#0c831f] text-white border-[#0c831f] shadow-xs scale-105'
                              : 'bg-[#fee9d7]/40 text-[#34222e] border-[#f9bf8f]/60 hover:bg-[#fee9d7]'
                          }`}
                        >
                          +{q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Dual Action CTAs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  
                  {/* Add to Cart CTA */}
                  <button
                    onClick={handleAddToCart}
                    disabled={product.stock <= 0}
                    className={`h-13 rounded-2xl font-extrabold text-sm sm:text-base flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md active:scale-[0.98] ${
                      addedSuccess 
                        ? 'bg-[#0c831f] text-white ring-4 ring-[#0c831f]/20' 
                        : 'bg-[#0c831f] hover:bg-[#0a701a] text-white'
                    }`}
                  >
                    {addedSuccess ? (
                      <>
                        <Check className="w-5 h-5 stroke-[2.5]" />
                        <span>Added {quantity} to Cart!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        <span>Add {quantity} to Cart • ₹{totalPrice.toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>

                  {/* Buy Now Instant Checkout CTA */}
                  <button
                    onClick={() => onBuyNow(product, quantity)}
                    disabled={product.stock <= 0}
                    className="h-13 rounded-2xl font-extrabold text-sm sm:text-base bg-[#34222e] hover:bg-[#20151c] text-white flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md active:scale-[0.98]"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Buy Now (Instant Checkout)</span>
                  </button>

                </div>

                {/* Delivery to Pincode Box */}
                <div className="p-4 bg-[#fee9d7]/30 rounded-2xl border border-[#f9bf8f]/60 space-y-2">
                  <form onSubmit={handlePincodeCheck} className="flex flex-wrap items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#e2434b] shrink-0" />
                    <span className="text-xs font-bold text-[#34222e] shrink-0">Deliver to Pincode:</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit PIN"
                      className="w-28 px-3 py-1.5 text-xs font-bold text-[#34222e] bg-white border border-[#f9bf8f] rounded-xl outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-[#0c831f] hover:bg-[#0a701a] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Check ETA
                    </button>
                  </form>
                  {pincodeStatus && (
                    <p className="text-[11px] text-[#0c831f] font-bold flex items-center space-x-1.5 pt-0.5">
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      <span>{pincodeStatus}</span>
                    </p>
                  )}
                </div>

                {/* Spaceborn 4 Pillars of Trust */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs border-t border-[#f9bf8f]/40">
                  <div className="flex items-center space-x-2 text-[#34222e]">
                    <div className="w-7 h-7 rounded-lg bg-[#f2fcf4] flex items-center justify-center text-[#0c831f] shrink-0 border border-[#0c831f]/20">
                      <Zap className="w-4 h-4 fill-[#0c831f]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold">10-15 Min Runner Dispatch</h4>
                      <p className="text-[10px] text-[#7a6274]">From localized warehouse hubs</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-[#34222e]">
                    <div className="w-7 h-7 rounded-lg bg-[#f2fcf4] flex items-center justify-center text-[#0c831f] shrink-0 border border-[#0c831f]/20">
                      <ShieldCheck className="w-4 h-4 text-[#0c831f]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold">100% Genuine ICs</h4>
                      <p className="text-[10px] text-[#7a6274]">Lab verified component grade</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-[#34222e]">
                    <div className="w-7 h-7 rounded-lg bg-[#f2fcf4] flex items-center justify-center text-[#0c831f] shrink-0 border border-[#0c831f]/20">
                      <RotateCcw className="w-4 h-4 text-[#0c831f]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold">7-Day Easy Replacements</h4>
                      <p className="text-[10px] text-[#7a6274]">Quick exchange if defective</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-[#34222e]">
                    <div className="w-7 h-7 rounded-lg bg-[#f2fcf4] flex items-center justify-center text-[#0c831f] shrink-0 border border-[#0c831f]/20">
                      <Receipt className="w-4 h-4 text-[#0c831f]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold">GST Tax Invoice</h4>
                      <p className="text-[10px] text-[#7a6274]">Instant ITC download</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>

        {/* Tabbed Technical Specifications & Documentation */}
        <div id="specs" className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-6 sm:p-8 lg:p-10 mb-8 shadow-xs">
          
          {/* Tab Navigation Pill Bar */}
          <div className="flex items-center space-x-2 border-b border-[#f9bf8f]/40 pb-4 overflow-x-auto no-scrollbar">
            {[
              { id: 'specs', label: 'Technical Specifications' },
              { id: 'pinout', label: 'Pinout & Wiring Diagram' },
              { id: 'package', label: 'Package Contents' },
              { id: 'reviews', label: `Maker Reviews (${product.reviewsCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#0c831f] text-white shadow-xs'
                    : 'text-[#7a6274] hover:bg-[#fee9d7]/50 hover:text-[#34222e]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Technical Specifications */}
          {activeTab === 'specs' && (
            <div className="pt-6 space-y-6">
              <p className="text-xs sm:text-sm text-[#7a6274] leading-relaxed max-w-4xl">
                {product.description}
              </p>

              <div className="overflow-hidden border border-[#f9bf8f]/60 rounded-2xl bg-white shadow-2xs">
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="bg-[#fee9d7]/70 text-[#34222e] font-extrabold border-b border-[#f9bf8f]/40">
                    <tr>
                      <th className="px-5 py-3 w-1/3">Parameter</th>
                      <th className="px-5 py-3">Engineering Specification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f9bf8f]/30 font-medium text-[#7a6274]">
                    {Object.entries(product.specifications).map(([key, value], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fffbf7]'}>
                        <td className="px-5 py-3 font-bold text-[#34222e]">{key}</td>
                        <td className="px-5 py-3 font-mono text-[#34222e]">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Highlights & Features */}
              <div className="pt-2">
                <h4 className="text-xs sm:text-sm font-extrabold text-[#34222e] uppercase tracking-wider mb-3">
                  Highlights & Features
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs sm:text-sm text-[#7a6274]">
                  {product.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start space-x-2.5 p-3 rounded-2xl bg-white border border-[#f9bf8f]/40">
                      <CheckCircle2 className="w-4 h-4 text-[#0c831f] shrink-0 mt-0.5" />
                      <span className="font-medium text-[#34222e]">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Tab 2: Pinout Diagram & Wire Color Code */}
          {activeTab === 'pinout' && (
            <div className="pt-6 space-y-6">
              <div className="bg-[#f2fcf4] border border-[#0c831f]/20 rounded-2xl p-4 text-xs sm:text-sm text-[#34222e] flex items-start space-x-3">
                <Info className="w-5 h-5 text-[#0c831f] shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block text-[#34222e]">Signal & Interface Standards</span>
                  <span className="text-[#7a6274] leading-relaxed">
                    Standard 2.54mm pitch headers. Ensure VCC logic level matches your MCU logic voltage (3.3V or 5V) before powering.
                  </span>
                </div>
              </div>

              {product.pinout && (
                <div className="overflow-hidden border border-[#f9bf8f]/60 rounded-2xl bg-white shadow-2xs">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-[#fee9d7]/70 text-[#34222e] font-extrabold border-b border-[#f9bf8f]/40">
                      <tr>
                        <th className="px-5 py-3">Pin</th>
                        <th className="px-5 py-3">Wire / Pad Color</th>
                        <th className="px-5 py-3">Signal Name</th>
                        <th className="px-5 py-3">Functional Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f9bf8f]/30 font-medium text-[#7a6274]">
                      {product.pinout.map((p, idx) => (
                        <tr key={idx} className="hover:bg-[#fffbf7]">
                          <td className="px-5 py-3 font-bold text-[#34222e]">{p.pin}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center space-x-2">
                              <span 
                                className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0 shadow-2xs" 
                                style={{ backgroundColor: p.color.toLowerCase() === 'white' ? '#f8f9fa' : p.color.toLowerCase() }}
                              />
                              <span className="font-medium text-[#34222e]">{p.color}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-[#e2434b]">{p.function}</td>
                          <td className="px-5 py-3 text-[#7a6274]">{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Package Includes */}
          {activeTab === 'package' && (
            <div className="pt-6 space-y-4">
              <h4 className="text-xs sm:text-sm font-extrabold text-[#34222e] uppercase tracking-wider">
                Box & Package Contents
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-[#7a6274]">
                {product.packageIncludes.map((item, idx) => (
                  <li key={idx} className="flex items-center space-x-3 p-3.5 bg-white rounded-2xl border border-[#f9bf8f]/40 shadow-2xs">
                    <Box className="w-5 h-5 text-[#0c831f] shrink-0" />
                    <span className="font-bold text-[#34222e]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tab 4: Reviews */}
          {activeTab === 'reviews' && (
            <div className="pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white rounded-3xl border border-[#f9bf8f]/60 shadow-2xs">
                <div className="flex items-center space-x-5">
                  <span className="text-4xl sm:text-5xl font-black text-[#34222e]">{product.rating}</span>
                  <div>
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs text-[#7a6274] font-medium">
                      Based on {product.reviewsCount} verified maker & lab reviews
                    </span>
                  </div>
                </div>
              </div>

              {/* Sample Reviews */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    name: 'Rajesh Sharma',
                    org: 'Robotics Lab',
                    date: '2 weeks ago',
                    title: 'Accurate and reliable ranging',
                    comment: 'Works out of the box with Arduino NewPing library. High precision ranging up to 400cm.',
                    rating: 5
                  },
                  {
                    name: 'Ananya Deshmukh',
                    org: 'Automation Team',
                    date: '1 month ago',
                    title: 'Clean signal without false triggers',
                    comment: 'High quality transducers and prompt 10-minute dispatch. Re-ordering for our robotics batch.',
                    rating: 5
                  }
                ].map((rev, idx) => (
                  <div key={idx} className="p-5 rounded-3xl border border-[#f9bf8f]/40 bg-white space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-[#34222e]">{rev.name}</span>
                        <span className="text-[#7a6274]">({rev.org})</span>
                        <span className="text-[10px] bg-[#f2fcf4] text-[#0c831f] font-bold px-2 py-0.5 rounded-lg border border-[#0c831f]/20">
                          Verified Buyer
                        </span>
                      </div>
                      <span className="text-[#7a6274] text-[11px] font-medium">{rev.date}</span>
                    </div>

                    <div className="flex text-amber-400">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>

                    <h5 className="text-xs sm:text-sm font-bold text-[#34222e]">{rev.title}</h5>
                    <p className="text-xs text-[#7a6274] leading-relaxed">{rev.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Related Components Carousel / Grid */}
        {relatedProducts.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-extrabold text-[#34222e]">
                Related Components in {product.category}
              </h3>
              <button
                onClick={() => onNavigate('catalog')}
                className="text-xs font-bold text-[#e2434b] hover:text-[#c7323a] flex items-center space-x-1 cursor-pointer"
              >
                <span>View Category</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {relatedProducts.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onSelect={onSelectProduct}
                  onAddToCart={(prod, qty) => onAddToCart(prod, qty || 1)}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
