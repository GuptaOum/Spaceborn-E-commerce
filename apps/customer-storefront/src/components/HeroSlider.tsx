'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Cpu, Box, Sparkles, Wrench, Zap } from 'lucide-react';
import type { SlideTone } from '@spaceborn/web-core/storefront';
import type { AppView } from '../types';
import { useStorefront } from '../context/StorefrontConfig';
import { followCta } from '../lib/cta';

interface HeroSliderProps {
  onNavigate: (view: AppView) => void;
  onSelectCategory: (category: string) => void;
}

/** Colour treatment per slide tone; the admin picks a tone instead of raw colours. */
const TONES: Record<SlideTone, { tag: string; highlight: string; gradient: string }> = {
  sky: { tag: 'bg-[#e0f2fe] text-[#0369a1]', highlight: 'text-[#0284c7]', gradient: 'from-sb-card via-[#f0f9ff] to-[#e0f2fe]/50' },
  coral: { tag: 'bg-[#fef2f2] text-[#e2434b]', highlight: 'text-[#e2434b]', gradient: 'from-sb-card via-[#fff5f5] to-[#fef2f2]' },
  green: { tag: 'bg-sb-brand-soft text-sb-brand', highlight: 'text-sb-brand', gradient: 'from-sb-card via-sb-brand-soft to-sb-brand-soft' },
  amber: { tag: 'bg-[#fefce8] text-[#ca8a04]', highlight: 'text-[#ca8a04]', gradient: 'from-sb-card via-[#fefce8] to-[#fef9c3]/50' },
  plum: { tag: 'bg-sb-canvas text-sb-ink', highlight: 'text-sb-ink', gradient: 'from-sb-card via-sb-canvas/60 to-sb-canvas' },
};

export const HeroSlider: React.FC<HeroSliderProps> = ({ onNavigate, onSelectCategory }) => {
  const { settings, categories } = useStorefront();
  const slides = settings?.hero.slides.filter((s) => s.enabled) ?? [];
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isArrowAnimating, setIsArrowAnimating] = useState<'left' | 'right' | null>(null);
  // Touch swipe (phones hide the arrow buttons, so swiping is the way to change slides there).
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;
  const index = count ? currentSlide % count : 0;

  const nextSlide = useCallback(() => {
    if (count) setCurrentSlide((prev) => (prev + 1) % count);
  }, [count]);

  const prevSlide = useCallback(() => {
    if (count) setCurrentSlide((prev) => (prev - 1 + count) % count);
  }, [count]);

  const handleArrowClick = (dir: 'left' | 'right') => {
    setIsArrowAnimating(dir);
    if (dir === 'left') {
      prevSlide();
    } else {
      nextSlide();
    }
    setTimeout(() => setIsArrowAnimating(null), 300);
  };

  useEffect(() => {
    if (isPaused || count < 2) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide, count]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setIsPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    setIsPaused(false);
    const end = e.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    const delta = end - start;
    if (Math.abs(delta) < 40) return; // a tap, not a swipe
    if (delta < 0) nextSlide();
    else prevSlide();
  };

  const goToCategory = (id: string) => followCta({ kind: 'category', categoryId: id }, categories, onNavigate, onSelectCategory);

  return (
    <div 
      className="relative rounded-3xl overflow-hidden shadow-sm border border-sb-line/60 select-none group bg-sb-card"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Sliding Track Viewport */}
      <div
        className="relative overflow-hidden min-h-[230px] sm:min-h-[290px] md:min-h-[310px] touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {count === 0 && <div className="absolute inset-0 bg-gradient-to-r from-sb-card to-sb-canvas/60 animate-pulse" />}
        <div 
          className="flex transition-transform duration-500 ease-out h-full"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, idx) => {
            const tone = TONES[slide.tone] ?? TONES.plum;
            const go = () => followCta(slide.cta, categories, onNavigate, onSelectCategory);
            return (
            <div
              key={slide.id}
              className={`min-w-full w-full shrink-0 relative bg-gradient-to-r ${tone.gradient} flex flex-col justify-between p-4 sm:p-7 md:p-9`}
            >
              {/* Top Tag Badges Row */}
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-center gap-2">
                  {slide.tag && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-black tracking-wide uppercase ${tone.tag} shadow-2xs border border-black/5`}>
                      <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>{slide.tag}</span>
                    </span>
                  )}
                  {slide.badge && (
                    <span className="hidden sm:inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/80 text-sb-ink border border-sb-line/50 shadow-2xs">
                      {slide.badge}
                    </span>
                  )}
                </div>
                {count > 1 && (
                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-sb-muted font-bold bg-white/70 px-2 sm:px-2.5 py-0.5 rounded-full border border-sb-line/40">
                    <span className="text-sb-ink font-black">{idx + 1}</span>
                    <span>/</span>
                    <span>{count}</span>
                  </div>
                )}
              </div>

              {/* Center Content: Two Columns (Text Left, Real Media Right) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 md:gap-6 items-center my-auto">
                <div className={`${slide.imageUrl ? 'md:col-span-7 lg:col-span-8' : 'md:col-span-12'} space-y-1.5 sm:space-y-3`}>
                  <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-[28px] font-black text-sb-ink tracking-tight leading-snug">
                    <span>{slide.title} </span>
                    {slide.highlight && (
                      <span className={`${tone.highlight} underline decoration-current/25 decoration-2 underline-offset-4`}>
                        {slide.highlight}
                      </span>
                    )}
                  </h2>
                  {slide.subtitle && (
                    <p className="text-xs sm:text-[13px] text-sb-ink/80 line-clamp-2 sm:line-clamp-2 max-w-xl font-medium leading-relaxed">
                      {slide.subtitle}
                    </p>
                  )}

                  {/* CTA Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={go}
                      className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-sb-brand hover:bg-sb-brand-strong text-white font-extrabold text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer group/btn"
                    >
                      <span>{slide.ctaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Right Media Column - Displayed cleanly from sm up */}
                {slide.imageUrl && (
                  <div className="hidden sm:flex md:col-span-5 lg:col-span-4 justify-center md:justify-end">
                    <div 
                      onClick={go}
                      className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-none h-32 sm:h-40 md:h-48 rounded-2xl overflow-hidden bg-white border border-sb-line/60 shadow-sm p-1.5 flex items-center justify-center cursor-pointer group/media hover:shadow-md transition-all"
                    >
                      <img
                        src={slide.imageUrl}
                        alt={[slide.title, slide.highlight].filter(Boolean).join(' ')}
                        className="w-full h-full object-contain rounded-xl group-hover/media:scale-105 transition-transform duration-300"
                        loading={idx === 0 ? 'eager' : 'lazy'}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Row Spacing */}
              <div className="h-4" />
            </div>
            );
          })}
        </div>

        {count > 1 && (
          <>
            {/* Elongated Pill Indicators (Robu / Blinkit style) */}
            <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 sm:left-8 sm:translate-x-0 z-20 flex items-center space-x-1.5 bg-white/80 backdrop-blur-xs px-2.5 py-1.5 rounded-full border border-sb-line/60 shadow-2xs">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSlide(idx)}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    index === idx 
                      ? 'w-6 h-1.5 bg-sb-brand' 
                      : 'w-1.5 h-1.5 bg-sb-muted/30 hover:bg-sb-muted/60'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Previous / Next Arrow Controls with Click Micro-Interactions */}
            <button
              type="button"
              onClick={() => handleArrowClick('left')}
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-sb-ink hidden sm:flex items-center justify-center shadow-md backdrop-blur-xs transition-all duration-200 cursor-pointer border border-sb-line/70 z-20 hover:scale-110 active:scale-90 ${
                isArrowAnimating === 'left' ? 'animate-arrow-bounce ring-2 ring-sb-brand' : ''
              }`}
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 text-sb-ink" />
            </button>
            <button
              type="button"
              onClick={() => handleArrowClick('right')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-sb-ink hidden sm:flex items-center justify-center shadow-md backdrop-blur-xs transition-all duration-200 cursor-pointer border border-sb-line/70 z-20 hover:scale-110 active:scale-90 ${
                isArrowAnimating === 'right' ? 'animate-arrow-bounce ring-2 ring-sb-brand' : ''
              }`}
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 text-sb-ink" />
            </button>
          </>
        )}
      </div>

      {/* Quick service anchors beneath the slider */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-sb-card divide-x divide-y md:divide-y-0 divide-sb-line/40 border-t border-sb-line/60">
        <button
          type="button"
          onClick={() => onNavigate('fabrication')}
          className="p-3 text-left hover:bg-sb-canvas/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#ebf5ff] text-[#0284c7] flex items-center justify-center shrink-0 border border-[#0284c7]/20 group-hover:scale-105 transition-transform">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-sb-ink leading-none mb-0.5">3D Printing</p>
            <p className="text-[10px] text-sb-muted leading-tight">Quotes from local makers</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => goToCategory('3d-printing')}
          className="p-3 text-left hover:bg-sb-canvas/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#fef2f2] text-[#e2434b] flex items-center justify-center shrink-0 border border-[#e2434b]/20 group-hover:scale-105 transition-transform">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-sb-ink leading-none mb-0.5">Printers & CNC</p>
            <p className="text-[10px] text-sb-muted leading-tight">Machines, lasers & filament</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => goToCategory('dev-boards')}
          className="p-3 text-left hover:bg-sb-canvas/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] text-[#059669] flex items-center justify-center shrink-0 border border-[#059669]/20 group-hover:scale-105 transition-transform">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-sb-ink leading-none mb-0.5">Dev Boards</p>
            <p className="text-[10px] text-sb-muted leading-tight">Raspberry Pi & ESP32</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('catalog')}
          className="p-3 text-left hover:bg-sb-canvas/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#fefce8] text-[#ca8a04] flex items-center justify-center shrink-0 border border-[#ca8a04]/20 group-hover:scale-105 transition-transform">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-sb-ink leading-none mb-0.5">Nearest-shop delivery</p>
            <p className="text-[10px] text-sb-muted leading-tight">Kanpur, Blr, Chennai, Pune</p>
          </div>
        </button>
      </div>
    </div>
  );
};
