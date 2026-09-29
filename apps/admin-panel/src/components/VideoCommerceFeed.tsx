'use client';
import React, { useState, useRef } from 'react';
import { ProductVideoReel, Product } from '../types';
import { VIDEO_REELS_DATA } from '../data/videoReels';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Heart, 
  Share2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ShoppingBag, 
  Zap, 
  Plus, 
  Check, 
  UploadCloud, 
  ShieldCheck, 
  Flame,
  Award
} from 'lucide-react';

interface VideoCommerceFeedProps {
  onAddToCart: (product: Product, quantity?: number) => void;
  onSelectProduct: (product: Product) => void;
  allProducts: Product[];
}

export const VideoCommerceFeed: React.FC<VideoCommerceFeedProps> = ({
  onAddToCart,
  onSelectProduct,
  allProducts,
}) => {
  const [activeReel, setActiveReel] = useState<ProductVideoReel | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [likedReels, setLikedReels] = useState<Record<string, boolean>>({});
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [addedReelId, setAddedReelId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleToggleLike = (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedReels(prev => ({ ...prev, [reelId]: !prev[reelId] }));
  };

  const handleOpenReel = (reel: ProductVideoReel) => {
    setActiveReel(reel);
    setIsPlaying(true);
  };

  const handleCloseReel = () => {
    setActiveReel(null);
  };

  const handleNextReel = () => {
    if (!activeReel) return;
    const currentIndex = VIDEO_REELS_DATA.findIndex(r => r.id === activeReel.id);
    const nextIndex = (currentIndex + 1) % VIDEO_REELS_DATA.length;
    setActiveReel(VIDEO_REELS_DATA[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrevReel = () => {
    if (!activeReel) return;
    const currentIndex = VIDEO_REELS_DATA.findIndex(r => r.id === activeReel.id);
    const prevIndex = (currentIndex - 1 + VIDEO_REELS_DATA.length) % VIDEO_REELS_DATA.length;
    setActiveReel(VIDEO_REELS_DATA[prevIndex]);
    setIsPlaying(true);
  };

  const handleQuickAdd = (reel: ProductVideoReel, e: React.MouseEvent) => {
    e.stopPropagation();
    const matchedProduct = allProducts.find(p => p.id === reel.productId) || {
      id: reel.productId,
      name: reel.productName,
      sku: 'SKU-REEL-' + reel.productId,
      category: 'Video Featured',
      subCategory: 'Verified Demos',
      price: reel.productPrice,
      originalPrice: reel.productOriginalPrice,
      hsn: '85011019',
      gstRate: 18,
      stock: 50,
      rating: 4.9,
      reviewsCount: 42,
      image: reel.productImage,
      description: reel.title,
      features: reel.highlights,
      brand: 'Spaceborn Lab Certified',
      packageIncludes: ['1x Hardware Unit', 'Lab Verification Certificate'],
      specifications: {}
    } as Product;

    onAddToCart(matchedProduct, 1);
    setAddedReelId(reel.id);
    setTimeout(() => {
      setAddedReelId(null);
    }, 1800);
  };

  return (
    <section className="py-6 px-4 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-rose-600" /> Watch & Buy • Quick Lab Shorts
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Real Hardware Bench Tests
            <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full hidden md:inline-flex">
              10-15 Min Delivery
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Watch unedited torque, flight thrust & RF spectrum tests. Tap product card in video to order instantly.
          </p>
        </div>

        {/* Sell / Submit Reel CTA */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center space-x-1.5 bg-white border border-slate-200 hover:border-orange-500 text-slate-700 hover:text-orange-600 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer shrink-0"
          >
            <UploadCloud className="w-4 h-4 text-orange-600" />
            <span>Submit Lab Test (+₹500 Credits)</span>
          </button>
        </div>
      </div>

      {/* Horizontal Carousel of Video Cards */}
      <div className="flex space-x-4 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory">
        {VIDEO_REELS_DATA.map((reel) => {
          const isLiked = likedReels[reel.id];
          const isAdded = addedReelId === reel.id;

          return (
            <div
              key={reel.id}
              onClick={() => handleOpenReel(reel)}
              className="relative shrink-0 w-60 sm:w-64 h-96 rounded-2xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 bg-slate-900 snap-start"
            >
              {/* Background Thumbnail Image with Gradient */}
              <img
                src={reel.thumbnailUrl}
                alt={reel.title}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-90"
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/40" />

              {/* Top overlay badges */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20">
                  <Zap className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {reel.deliveryMinutes}m ETA
                </span>
                
                <button
                  onClick={(e) => handleToggleLike(reel.id, e)}
                  className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:text-rose-400 transition-colors"
                >
                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
              </div>

              {/* Center Play Button indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-white/30 transition-all shadow-lg">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              </div>

              {/* Bottom In-Video Product Pill (Blinkit / TikTok Shop Style) */}
              <div className="absolute bottom-3 left-3 right-3 z-10">
                {/* Creator info & title */}
                <div className="flex items-center space-x-1.5 mb-1.5">
                  <img
                    src={reel.creatorAvatar}
                    alt={reel.creatorName}
                    className="w-5 h-5 rounded-full object-cover border border-white/60"
                  />
                  <span className="text-[11px] font-bold text-white drop-shadow truncate">{reel.creatorName}</span>
                  <span className="text-[9px] bg-emerald-500/80 text-white px-1.5 py-0.2 rounded font-medium">{reel.creatorTag}</span>
                </div>

                <p className="text-xs font-semibold text-white/95 line-clamp-2 leading-snug drop-shadow mb-2">
                  {reel.title}
                </p>

                {/* Instant Buy Product Chip */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#fffbf7]/95 backdrop-blur-md rounded-xl p-2 flex items-center justify-between border border-[#f9bf8f]/60 shadow-md group/chip hover:bg-[#fffbf7] transition-colors"
                >
                  <div className="flex items-center space-x-2 overflow-hidden pr-1">
                    <img
                      src={reel.productImage}
                      alt={reel.productName}
                      className="w-9 h-9 rounded-lg object-contain bg-[#fee9d7] border border-[#f9bf8f]/40 p-0.5 shrink-0"
                    />
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold text-[#34222e] truncate leading-tight">{reel.productName}</p>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-xs font-black text-[#34222e]">₹{reel.productPrice}</span>
                        {reel.productOriginalPrice && (
                          <span className="text-[9px] text-[#34222e]/40 line-through">₹{reel.productOriginalPrice}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleQuickAdd(reel, e)}
                    className={`h-7 px-2.5 rounded-lg font-black text-[10px] uppercase tracking-wider shrink-0 transition-all flex items-center justify-center space-x-1 cursor-pointer shadow-sm ${
                      isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#e2434b] hover:bg-[#c9323a] text-white'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>ADDED</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>ADD</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Immersive Video Reel Modal */}
      {activeReel && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl h-[92vh] max-h-[820px] bg-slate-950 rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl border border-slate-800">
            
            {/* Close button */}
            <button
              onClick={handleCloseReel}
              className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Left Column: Vertical Video Player */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                src={activeReel.videoUrl}
                poster={activeReel.thumbnailUrl}
                autoPlay
                loop
                playsInline
                muted={isMuted}
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => {
                  if (videoRef.current) {
                    if (videoRef.current.paused) {
                      videoRef.current.play();
                      setIsPlaying(true);
                    } else {
                      videoRef.current.pause();
                      setIsPlaying(false);
                    }
                  }
                }}
              />

              {/* Sound toggle & playback controls overlay */}
              <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <span className="text-[10px] font-bold text-white bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                  {isMuted ? 'Muted (Tap to unmute)' : 'Sound On'}
                </span>
              </div>

              {/* Prev / Next video controls */}
              <button
                onClick={handlePrevReel}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextReel}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Floating like / share counters */}
              <div className="absolute right-4 bottom-24 z-20 flex flex-col items-center space-y-4">
                <button
                  onClick={(e) => handleToggleLike(activeReel.id, e)}
                  className="flex flex-col items-center text-white"
                >
                  <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-transform">
                    <Heart className={`w-5 h-5 ${likedReels[activeReel.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </div>
                  <span className="text-[10px] font-bold mt-1">{likedReels[activeReel.id] ? activeReel.likes + 1 : activeReel.likes}</span>
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard?.writeText?.(window.location.href);
                    alert('Reel link copied to clipboard!');
                  }}
                  className="flex flex-col items-center text-white"
                >
                  <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-transform">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold mt-1">Share</span>
                </button>
              </div>

              {/* Bottom video captions */}
              <div className="absolute bottom-4 left-4 right-16 z-20 text-white">
                <div className="flex items-center space-x-2 mb-1">
                  <img
                    src={activeReel.creatorAvatar}
                    alt={activeReel.creatorName}
                    className="w-7 h-7 rounded-full object-cover border border-white/80"
                  />
                  <div>
                    <span className="text-xs font-black">{activeReel.creatorName}</span>
                    <span className="ml-2 text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">{activeReel.creatorTag}</span>
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-200 line-clamp-2 drop-shadow">
                  {activeReel.title}
                </p>
              </div>
            </div>

            {/* Right Column: In-Video Direct Buying Drawer */}
            <div className="w-full md:w-96 bg-[#fffbf7] p-5 flex flex-col justify-between overflow-y-auto border-l border-[#f9bf8f]/40">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#f9bf8f]/30 mb-4 pr-10">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-[#e2434b] bg-[#fee9d7] border border-[#f9bf8f] px-2.5 py-1 rounded-full">
                    <Zap className="w-3.5 h-3.5 fill-[#e2434b]" />
                    <span>Instant Delivery in {activeReel.deliveryMinutes} mins</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#34222e]/60">SKU: {activeReel.productId}</span>
                </div>

                {/* Product overview card */}
                <div className="flex items-center space-x-3 mb-4">
                  <img
                    src={activeReel.productImage}
                    alt={activeReel.productName}
                    className="w-20 h-20 rounded-xl object-contain bg-[#fee9d7] border border-[#f9bf8f]/50 p-1"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-[#34222e] leading-snug">{activeReel.productName}</h3>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <span className="text-lg font-black text-[#34222e]">₹{activeReel.productPrice}</span>
                      {activeReel.productOriginalPrice && (
                        <span className="text-xs text-[#34222e]/40 line-through">₹{activeReel.productOriginalPrice}</span>
                      )}
                      <span className="text-[10px] font-bold text-[#e2434b] bg-[#fee9d7] border border-[#f9bf8f] px-1.5 py-0.5 rounded">
                        {activeReel.discountPercent}% OFF
                      </span>
                    </div>
                    <p className="text-[10px] text-[#34222e]/70 mt-0.5 font-medium">Incl. 18% GST • GST Invoice Available</p>
                  </div>
                </div>

                {/* Lab Highlights */}
                <div className="bg-[#fee9d7]/70 rounded-xl p-3 border border-[#f9bf8f]/50 mb-4">
                  <div className="flex items-center space-x-1 text-[#34222e] font-bold text-xs mb-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#e2434b]" />
                    <span>Lab Test Verified Features:</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#34222e]/80 font-medium">
                    {activeReel.highlights.map((h, i) => (
                      <li key={i} className="flex items-center space-x-1.5">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Trust guarantee badge */}
                <div className="flex items-center space-x-2 text-[11px] text-[#34222e]/80 bg-[#f9bf8f]/30 border border-[#f9bf8f]/60 rounded-lg p-2.5 mb-4">
                  <Award className="w-4 h-4 text-[#e2434b] shrink-0" />
                  <span>Tested on oscilloscope & dynamometer before dispatch. 100% Replacement Warranty.</span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-[#f9bf8f]/30 space-y-2">
                <button
                  onClick={(e) => {
                    handleQuickAdd(activeReel, e);
                  }}
                  className="w-full bg-[#e2434b] hover:bg-[#c9323a] text-white font-extrabold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-[#e2434b]/30 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add To Cart (Instant 12-Min Dispatch)</span>
                </button>

                <button
                  onClick={() => {
                    const prod = allProducts.find(p => p.id === activeReel.productId);
                    if (prod) {
                      handleCloseReel();
                      onSelectProduct(prod);
                    }
                  }}
                  className="w-full bg-[#fee9d7] hover:bg-[#f9bf8f]/40 text-[#34222e] font-bold text-xs py-2.5 rounded-xl transition-colors text-center border border-[#f9bf8f]/60 cursor-pointer"
                >
                  View Full Engineering Datasheet & Pinouts
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Submit Lab Video Review Modal (Buy & Sell / Creator Program) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 text-orange-600 font-black text-xs uppercase tracking-wider mb-2">
              <UploadCloud className="w-4 h-4" />
              <span>Spaceborn Creator & Lab Testing Program</span>
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-1">
              Submit Your Hardware Test Video
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Show us your motor dynamometer test, oscilloscope trace, drone flight, or custom PCB soldering. Verified submissions receive <strong>₹500 store credits</strong> instantly!
            </p>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                alert('Thank you! Your video demo has been submitted for verification. Store credit coupon code will be emailed in 2 hours.');
                setShowUploadModal(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Hardware / Component Tested</label>
                <select className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-orange-500 outline-none bg-slate-50">
                  <option>N20 Micro Metal Gear Motor with Encoder</option>
                  <option>ESP32-WROOM-32D Development Board</option>
                  <option>40A 4-in-1 BLHeli_S DShot600 ESC</option>
                  <option>VL53L1X ToF LiDAR Distance Sensor</option>
                  <option>Custom 4-Layer PCB Stencil & SMD Assembly</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Video Link (YouTube Shorts / Drive / Cloudinary)</label>
                <input
                  type="url"
                  required
                  placeholder="https://youtube.com/shorts/... or cloud link"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Your Engineering Lab / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Maker Robotics Lab, Bengaluru"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Email / UPI ID for Reward Credits</label>
                <input
                  type="text"
                  required
                  placeholder="engineer@domain.com or upi@oksbi"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Submit for ₹500 Credits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
