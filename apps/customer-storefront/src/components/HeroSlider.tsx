'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Zap, ShieldCheck, Cpu, Box, Flame, Sparkles, Wrench } from 'lucide-react';
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
  title: string;
  subtitle: string;
  ctaText: string;
  action: () => void;
  badge?: string;
  accentColor: string;
  gradient: string;
  image: string;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ onNavigate, onSelectCategory }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slides: SlideItem[] = [
    {
      id: 'fabrication',
      tag: 'ON-DEMAND RAPID FABRICATION',
      tagBg: 'bg-[#fee9d7]',
      tagColor: 'text-[#34222e]',
      title: 'Precision 3D Printing & CNC Machining',
      subtitle: 'Upload STL/STEP files for instant quotes. SLA resin, industrial FDM, and CNC aluminum milling in Kanpur, Bengaluru & Chennai.',
      ctaText: 'Start 3D Print / CNC Order',
      action: () => onNavigate('fabrication'),
      badge: '24-48 HR DISPATCH',
      accentColor: '#e2434b',
      gradient: 'from-[#34222e] via-[#4a2e41] to-[#24131e]',
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'express',
      tag: '10-15 MINUTE LOCAL DISPATCH',
      tagBg: 'bg-[#ecfdf5]',
      tagColor: 'text-[#059669]',
      title: 'Hardware At Hyper-Speed',
      subtitle: 'Microcontrollers, sensors, soldering wire, and electronic components delivered to your lab or bench within minutes.',
      ctaText: 'Shop Instant Catalog',
      action: () => onNavigate('catalog'),
      badge: 'FREE DELIVERY ₹500+',
      accentColor: '#059669',
      gradient: 'from-[#143224] via-[#1e4835] to-[#0f241a]',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'dev-boards',
      tag: 'MICROCONTROLLERS & AI COMPUTE',
      tagBg: 'bg-[#e0f2fe]',
      tagColor: 'text-[#0369a1]',
      title: 'Raspberry Pi 5, ESP32-S3 & Arduino UNO',
      subtitle: 'Original boards, shields, and development tools with full pinout specs, GST tax invoice, and technical documentation.',
      ctaText: 'Explore Dev Boards',
      action: () => onSelectCategory('Dev Boards & MCUs'),
      badge: '100% GENUINE OEM',
      accentColor: '#0284c7',
      gradient: 'from-[#102a43] via-[#183d61] to-[#0b1d2e]',
      image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'motors-drones',
      tag: 'ROBOTICS & DRONE PROPULSION',
      tagBg: 'bg-[#fef3c7]',
      tagColor: 'text-[#b45309]',
      title: 'High-Torque Brushless Motors & ESCs',
      subtitle: 'Hobbywing, Sunnysky, planetary gearboxes, stepper motors, and LiPo batteries designed for heavy payloads and precision robots.',
      ctaText: 'View Motors & Drivers',
      action: () => onSelectCategory('Motors & Drivers'),
      badge: 'SPECIAL BULK DISCOUNTS',
      accentColor: '#d97706',
      gradient: 'from-[#3a2012] via-[#522f1b] to-[#25150c]',
      image: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=700&q=80',
    },
  ];

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 4500);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  const slide = slides[currentSlide];

  return (
    <div 
      className="relative rounded-3xl overflow-hidden shadow-sm border border-[#f9bf8f]/60 select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Slide Container */}
      <div className={`relative min-h-[220px] sm:min-h-[260px] md:min-h-[280px] bg-gradient-to-r ${slide.gradient} text-white flex flex-col justify-between p-6 sm:p-8 md:p-10 transition-all duration-500`}>
        
        {/* Subtle Background Glow & Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)] pointer-events-none" />
        
        {/* Top Badges */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wide ${slide.tagBg} ${slide.tagColor} shadow-xs`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{slide.tag}</span>
            </span>
            {slide.badge && (
              <span className="hidden sm:inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
                {slide.badge}
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-white/70 font-semibold">
            <span>{currentSlide + 1}</span>
            <span>/</span>
            <span>{slides.length}</span>
          </div>
        </div>

        {/* Center Content */}
        <div className="relative z-10 my-3 sm:my-4 max-w-2xl">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight mb-2 drop-shadow-xs">
            {slide.title}
          </h2>
          <p className="text-xs sm:text-sm text-white/80 line-clamp-2 max-w-xl font-normal leading-relaxed">
            {slide.subtitle}
          </p>
        </div>

        {/* Bottom CTA and Dots Row */}
        <div className="relative z-10 flex items-center justify-between gap-4 mt-auto">
          <button
            onClick={slide.action}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-[#fee9d7] text-[#34222e] font-extrabold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <span>{slide.ctaText}</span>
            <ArrowRight className="w-4 h-4 text-[#e2434b] stroke-[2.5]" />
          </button>

          {/* Robu-Style Elongated Pill Dots */}
          <div className="flex items-center space-x-1.5 bg-black/30 backdrop-blur-xs px-2.5 py-1.5 rounded-full border border-white/10">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  currentSlide === idx 
                    ? 'w-6 h-1.5 bg-[#f9bf8f]' 
                    : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Previous / Next Arrow Controls */}
        <button
          onClick={prevSlide}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-xs transition opacity-0 group-hover:opacity-100 cursor-pointer border border-white/10"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-xs transition opacity-0 group-hover:opacity-100 cursor-pointer border border-white/10"
          aria-label="Next slide"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Robu-Style 4 Quick Service Anchors Beneath Hero Slider */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-[#fffbf7] divide-x divide-y md:divide-y-0 divide-[#f9bf8f]/40 border-t border-[#f9bf8f]/60">
        <button
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
          onClick={() => onNavigate('fabrication')}
          className="p-3 text-left hover:bg-[#fee9d7]/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#fef2f2] text-[#e2434b] flex items-center justify-center shrink-0 border border-[#e2434b]/20 group-hover:scale-105 transition-transform">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#34222e] leading-none mb-0.5">CNC Machining</p>
            <p className="text-[10px] text-[#7a6274] leading-tight">Metal & Acrylic Milling</p>
          </div>
        </button>

        <button
          onClick={() => onSelectCategory('Dev Boards & MCUs')}
          className="p-3 text-left hover:bg-[#fee9d7]/50 transition flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] text-[#059669] flex items-center justify-center shrink-0 border border-[#059669]/20 group-hover:scale-105 transition-transform">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#34222e] leading-none mb-0.5">PCB & Microchips</p>
            <p className="text-[10px] text-[#7a6274] leading-tight">Fast Bare-Board & SMT</p>
          </div>
        </button>

        <button
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
