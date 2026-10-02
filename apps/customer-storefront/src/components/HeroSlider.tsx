'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Zap, Cpu, Box, Sparkles, Wrench, ShieldCheck, Flame } from 'lucide-react';
import type { AppView } from '../types';

interface HeroSliderProps {
  onNavigate: (view: AppView) => void;
  onSelectCategory: (category: string) => void;
}

interface SlideItem {
  id: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  titlePrefix: string;
  titleHighlight: string;
  titleSuffix?: string;
  highlightColor: string;
  subtitle: string;
  ctaText: string;
  action: () => void;
  badge?: string;
  bgGradient: string;
  cardBorder: string;
  image: string;
  imageAlt: string;
  pillBg: string;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ onNavigate, onSelectCategory }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isArrowAnimating, setIsArrowAnimating] = useState<'left' | 'right' | null>(null);
  // Touch swipe (phones hide the arrow buttons, so swiping is the way to change slides there).
  const touchStartX = useRef<number | null>(null);

  const slides: SlideItem[] = [
    {
      id: 'fabrication',
      tag: 'ON-DEMAND RAPID FABRICATION',
      tagBg: 'bg-[#fee9d7]',
      tagColor: 'text-[#34222e]',
      titlePrefix: 'Precision ',
      titleHighlight: '3D Printing & CNC Machining',
      highlightColor: 'text-[#0284c7]',
      subtitle: 'Upload STL/STEP files for instant auto-slicing quotes. Industrial SLA resin, nylon FDM, and CNC aluminum milling across Kanpur, Bengaluru & Chennai.',
      ctaText: 'Start 3D Print / CNC Order',
      action: () => onNavigate('fabrication'),
      badge: '24-48 HR DISPATCH',
      bgGradient: 'from-[#fffbf7] via-[#fef7ee] to-[#f0f9ff]',
      cardBorder: 'border-[#f9bf8f]/60',
      image: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/QRTZ1n9FqJpexURRjj346cRuDgh8CIXmACjH2W21.webp',
      imageAlt: '3D Printing and Rapid Prototyping Hardware',
      pillBg: '#0284c7',
    },
    {
      id: 'laser-cnc',
      tag: 'INDUSTRIAL FABRICATION LAB',
      tagBg: 'bg-[#fef2f2]',
      tagColor: 'text-[#e2434b]',
      titlePrefix: 'AtomStack ',
      titleHighlight: 'Laser Cutters & CNC Routers',
      highlightColor: 'text-[#e2434b]',
      subtitle: 'High-power optical laser modules, honeycomb beds, and precision desktop gantry kits for fast maker prototyping and custom lab enclosures.',
      ctaText: 'Explore CNC & Lasers',
      action: () => onSelectCategory('3D Printing & CNC'),
      badge: 'OFFICIAL DISTRIBUTOR',
      bgGradient: 'from-[#fffbf7] via-[#fff5f5] to-[#fef2f2]',
      cardBorder: 'border-[#f9bf8f]/60',
      image: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/TuNlwhjy7hrjVgrc35BW4CoxkD1BKLCoIExes2rM.webp',
      imageAlt: 'AtomStack Laser and CNC Prototyping Systems',
      pillBg: '#e2434b',
    },
    {
      id: 'dev-boards',
      tag: 'MICROCONTROLLERS & AI COMPUTE',
      tagBg: 'bg-[#e0f2fe]',
      tagColor: 'text-[#0369a1]',
      titlePrefix: 'Raspberry Pi 5 & ',
      titleHighlight: 'Edge AI Compute Kits',
      highlightColor: 'text-[#0284c7]',
      subtitle: 'Broadcom BCM2712 quad-core 2.4GHz Cortex-A76, PCIe 2.0 interface, dual 4K HDMI, and official active coolers with GST tax invoice.',
      ctaText: 'Explore Dev Boards',
      action: () => onSelectCategory('Development Boards'),
      badge: '100% GENUINE OEM',
      bgGradient: 'from-[#fffbf7] via-[#f0f9ff] to-[#e0f2fe]/50',
      cardBorder: 'border-[#0284c7]/30',
      image: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/iwKr8PucqQv18bbgVPs2Pq56jydYwpR2JIZ0eQ3q.webp',
      imageAlt: 'Raspberry Pi 5 and Development Compute Boards',
      pillBg: '#0284c7',
    },
    {
      id: 'express',
      tag: '10-15 MINUTE LOCAL DISPATCH',
      tagBg: 'bg-[#ecfdf5]',
      tagColor: 'text-[#0c831f]',
      titlePrefix: 'Arduino UNO, ESP32 & ',
      titleHighlight: 'Sensors at Hyper-Speed',
      highlightColor: 'text-[#0c831f]',
      subtitle: 'LiDAR, IMUs, environmental sensors, load cells, and jumper wires delivered straight to your workbench within minutes.',
      ctaText: 'Shop Instant Catalog',
      action: () => onNavigate('catalog'),
      badge: 'FREE DELIVERY ₹500+',
      bgGradient: 'from-[#fffbf7] via-[#f2fcf4] to-[#ecfdf5]',
      cardBorder: 'border-[#10b981]/30',
      image: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/u9XlzD9ZM45DD7v7fUZ4vpVUt67ZdPmISg6BlCd1.webp',
      imageAlt: 'Arduino, ESP32 and Sensors Suite',
      pillBg: '#0c831f',
    },
    {
      id: 'motors-drones',
      tag: 'ROBOTICS & DRONE PROPULSION',
      tagBg: 'bg-[#fefce8]',
      tagColor: 'text-[#ca8a04]',
      titlePrefix: 'High-Torque BLDC Motors & ',
      titleHighlight: 'Drone ESC Modules',
      highlightColor: 'text-[#ca8a04]',
      subtitle: 'Sunnysky, planetary gearboxes, stepper motors, and high-discharge LiPo packs ready for autonomous robotics and drone flights.',
      ctaText: 'View Motors & Drivers',
      action: () => onSelectCategory('Motors & Drivers'),
      badge: 'BULK LAB PRICING',
      bgGradient: 'from-[#fffbf7] via-[#fefce8] to-[#fef9c3]/50',
      cardBorder: 'border-[#f9bf8f]/60',
      image: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/IOwkD9oyO090Cu2A7W0HAkQWsKLZj8GtO216E1jv.webp',
      imageAlt: 'Brushless DC Motors and Drone Electronic Speed Controllers',
      pillBg: '#ca8a04',
    },
  ];

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

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
    if (isPaused) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

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

  return (
    <div 
      className="relative rounded-3xl overflow-hidden shadow-sm border border-[#f9bf8f]/60 select-none group bg-[#fffbf7]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Sliding Track Viewport */}
      <div
        className="relative overflow-hidden min-h-[230px] sm:min-h-[290px] md:min-h-[310px] touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div 
          className="flex transition-transform duration-500 ease-out h-full"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className={`min-w-full w-full shrink-0 relative bg-gradient-to-r ${slide.bgGradient} flex flex-col justify-between p-4 sm:p-7 md:p-9`}
            >
              {/* Top Tag Badges Row */}
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-black tracking-wide ${slide.tagBg} ${slide.tagColor} shadow-2xs border border-black/5`}>
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>{slide.tag}</span>
                  </span>
                  {slide.badge && (
                    <span className="hidden sm:inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-[#34222e] border border-[#f9bf8f]/50 shadow-2xs">
                      {slide.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[#7a6274] font-bold bg-white/70 px-2 sm:px-2.5 py-0.5 rounded-full border border-[#f9bf8f]/40">
                  <span className="text-[#34222e] font-black">{idx + 1}</span>
                  <span>/</span>
                  <span>{slides.length}</span>
                </div>
              </div>

              {/* Center Content: Two Columns (Text Left, Real Media Right) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 md:gap-6 items-center my-auto">
                {/* Left Text Column (Rich Dark Brand Charcoal / Teal Blue Typography) */}
                <div className="md:col-span-7 lg:col-span-8 space-y-1.5 sm:space-y-3">
                  <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-[28px] font-black text-[#34222e] tracking-tight leading-snug">
                    <span>{slide.titlePrefix}</span>
                    <span className={`${slide.highlightColor} underline decoration-current/25 decoration-2 underline-offset-4`}>
                      {slide.titleHighlight}
                    </span>
                    {slide.titleSuffix && <span>{slide.titleSuffix}</span>}
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[#5a4454] line-clamp-2 sm:line-clamp-2 max-w-xl font-medium leading-relaxed">
                    {slide.subtitle}
                  </p>

                  {/* CTA Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={slide.action}
                      className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#0c831f] hover:bg-[#0a6e1a] text-white font-extrabold text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer group/btn"
                    >
                      <span>{slide.ctaText}</span>
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Right Media Column - Displayed cleanly from sm up */}
                <div className="hidden sm:flex md:col-span-5 lg:col-span-4 justify-center md:justify-end">
                  <div 
                    onClick={slide.action}
                    className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-none h-32 sm:h-40 md:h-48 rounded-2xl overflow-hidden bg-white border border-[#f9bf8f]/60 shadow-sm p-1.5 flex items-center justify-center cursor-pointer group/media hover:shadow-md transition-all"
                  >
                    <img
                      src={slide.image}
                      alt={slide.imageAlt}
                      className="w-full h-full object-contain rounded-xl group-hover/media:scale-105 transition-transform duration-300"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                    />
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[9.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs pointer-events-none">
                      <Zap className="w-2.5 h-2.5 text-[#f8cb46]" />
                      <span>Ready to Ship</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row Spacing */}
              <div className="h-4" />
            </div>
          ))}
        </div>

        {/* Elongated Pill Indicators (Robu / Blinkit style) */}
        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 sm:left-8 sm:translate-x-0 z-20 flex items-center space-x-1.5 bg-white/80 backdrop-blur-xs px-2.5 py-1.5 rounded-full border border-[#f9bf8f]/60 shadow-2xs">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              className={`transition-all duration-300 rounded-full cursor-pointer ${
                currentSlide === idx 
                  ? 'w-6 h-1.5 bg-[#0c831f]' 
                  : 'w-1.5 h-1.5 bg-[#7a6274]/30 hover:bg-[#7a6274]/60'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Previous / Next Arrow Controls with Click Micro-Interactions */}
        <button
          type="button"
          onClick={() => handleArrowClick('left')}
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#34222e] hidden sm:flex items-center justify-center shadow-md backdrop-blur-xs transition-all duration-200 cursor-pointer border border-[#f9bf8f]/70 z-20 hover:scale-110 active:scale-90 ${
            isArrowAnimating === 'left' ? 'animate-arrow-bounce ring-2 ring-[#0c831f]' : ''
          }`}
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5 text-[#34222e]" />
        </button>
        <button
          type="button"
          onClick={() => handleArrowClick('right')}
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#34222e] hidden sm:flex items-center justify-center shadow-md backdrop-blur-xs transition-all duration-200 cursor-pointer border border-[#f9bf8f]/70 z-20 hover:scale-110 active:scale-90 ${
            isArrowAnimating === 'right' ? 'animate-arrow-bounce ring-2 ring-[#0c831f]' : ''
          }`}
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5 text-[#34222e]" />
        </button>
      </div>

      {/* Robu-Style 4 Quick Service Anchors Beneath Hero Slider */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-[#fffbf7] divide-x divide-y md:divide-y-0 divide-[#f9bf8f]/40 border-t border-[#f9bf8f]/60">
        <button
          type="button"
          onClick={() => onNavigate('fabrication')}
          className="p-3 text-left hover:bg-[#fee9d7]/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#ebf5ff] text-[#0284c7] flex items-center justify-center shrink-0 border border-[#0284c7]/20 group-hover:scale-105 transition-transform">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#34222e] leading-none mb-0.5">3D Printing</p>
            <p className="text-[10px] text-[#7a6274] leading-tight">Instant SLA & FDM</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectCategory('3D Printing & CNC')}
          className="p-3 text-left hover:bg-[#fee9d7]/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#fef2f2] text-[#e2434b] flex items-center justify-center shrink-0 border border-[#e2434b]/20 group-hover:scale-105 transition-transform">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#34222e] leading-none mb-0.5">CNC Machining</p>
            <p className="text-[10px] text-[#7a6274] leading-tight">Laser & Metal Milling</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectCategory('Development Boards')}
          className="p-3 text-left hover:bg-[#fee9d7]/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] text-[#059669] flex items-center justify-center shrink-0 border border-[#059669]/20 group-hover:scale-105 transition-transform">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#34222e] leading-none mb-0.5">PCB & Microchips</p>
            <p className="text-[10px] text-[#7a6274] leading-tight">Raspberry Pi & ESP32</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('catalog')}
          className="p-3 text-left hover:bg-[#fee9d7]/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#fefce8] text-[#ca8a04] flex items-center justify-center shrink-0 border border-[#ca8a04]/20 group-hover:scale-105 transition-transform">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#34222e] leading-none mb-0.5">10-15 Min Dispatch</p>
            <p className="text-[10px] text-[#7a6274] leading-tight">Kanpur, Blr, Chennai</p>
          </div>
        </button>
      </div>
    </div>
  );
};
