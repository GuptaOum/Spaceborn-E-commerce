'use client';

import React from 'react';
import { Product, AppView } from '../types';
import { ProductCard } from '../components/ProductCard';
import { 
  ArrowRight, 
  ChevronRight,
  Zap,
  Cog,
  Cpu,
  Radio,
  BatteryCharging,
  Wrench,
  Bot,
  Cable,
  Package
} from 'lucide-react';

interface HomeViewProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number) => void;
  onQuickView: (product: Product) => void;
  onSelectCategory: (category: string) => void;
  onNavigate: (view: AppView) => void;
  cart: { product: Product; quantity: number }[];
}

// Clean Blinkit-style category aisles with crisp Lucide icons
const QUICK_CATEGORIES = [
  { name: 'Dev Boards', icon: Cpu, color: '#0369a1', category: 'Dev Boards & MCUs', bg: '#E0F2FE' },
  { name: 'Sensors', icon: Radio, color: '#047857', category: 'Sensors & Modules', bg: '#ECFDF5' },
  { name: 'Motors', icon: Cog, color: '#b45309', category: 'Motors & Drivers', bg: '#FEF3C7' },
  { name: 'Batteries', icon: BatteryCharging, color: '#b91c1c', category: 'Batteries & Power', bg: '#FEE2E2' },
  { name: 'Tools', icon: Wrench, color: '#6d28d9', category: 'Tools & Accessories', bg: '#EDE9FE' },
  { name: 'Mechanical', icon: Bot, color: '#c2410c', category: 'Mechanical & Frames', bg: '#FFEDD5' },
  { name: 'All Items', icon: Package, color: '#be185d', category: 'All Categories', bg: '#FCE7F3' },
];

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  onSelectProduct,
  onAddToCart,
  onQuickView,
  onSelectCategory,
  onNavigate,
  cart,
}) => {
  const trendingProducts = products.slice(0, 16);
  const devBoards = products.filter(p => p.category === 'Dev Boards & MCUs').slice(0, 8);
  const sensorsAndMotors = products.filter(p => p.category === 'Sensors & Modules' || p.category === 'Motors & Drivers').slice(0, 8);

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] pb-24">
      
      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">

        {/* Clean, Welcoming Hero Banner */}
        <div className="bg-[#fffbf7] rounded-3xl p-6 sm:p-8 border border-[#f9bf8f]/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f2fcf4] text-[#0c831f] text-xs font-bold border border-[#0c831f]/20">
              <Zap className="w-3.5 h-3.5 fill-[#0c831f]" />
              Delivery in 10-15 minutes
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#34222e] tracking-tight leading-tight">
              Electronics & hardware components delivered to your door.
            </h1>
            <p className="text-xs sm:text-sm text-[#7a6274] leading-relaxed">
              Genuine microcontrollers, sensors, motors, and workbench essentials ready for instant dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('catalog')}
              className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Explore Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('fabrication')}
              className="bg-[#34222e] hover:bg-[#1a0f16] text-[#fee9d7] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm cursor-pointer active:scale-95"
            >
              3D Print & CNC near you
            </button>
          </div>
        </div>

        {/* Categories Grid */}
        <section className="bg-[#fffbf7] rounded-3xl p-5 sm:p-6 shadow-xs border border-[#f9bf8f]/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-[#34222e]">
              Shop by Category
            </h2>
            <button
              onClick={() => onNavigate('catalog')}
              className="text-xs font-bold text-[#e2434b] hover:text-[#c7323a] flex items-center space-x-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {QUICK_CATEGORIES.map((cat, index) => {
              const Icon = cat.icon;
              return (
                <div
                  key={index}
                  onClick={() => {
                    onSelectCategory(cat.category);
                    onNavigate('catalog');
                  }}
                  className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-[#fee9d7]/40 border border-transparent hover:border-[#f9bf8f]/50 transition-all cursor-pointer"
                >
                  <div 
                    style={{ backgroundColor: cat.bg }}
                    className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border border-black/5 flex items-center justify-center group-hover:scale-105 transition-all shadow-xs mb-2"
                  >
                    <Icon className="w-6 h-6" style={{ color: cat.color }} />
                  </div>
                  <span className="text-xs font-medium text-[#34222e] leading-tight group-hover:text-[#e2434b] transition-colors line-clamp-1">
                    {cat.name}
                  </span>
                </div>
              );
            })}
            <div
              onClick={() => onNavigate('fabrication')}
              className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-[#fee9d7]/40 border border-transparent hover:border-[#f9bf8f]/50 transition-all cursor-pointer"
            >
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border border-black/5 bg-[#34222e] flex items-center justify-center group-hover:scale-105 transition-all shadow-xs mb-2">
                <Cable className="w-6 h-6 text-[#f8cb46]" />
              </div>
              <span className="text-xs font-bold text-[#34222e] leading-tight line-clamp-1">Print & CNC</span>
            </div>
          </div>
        </section>

        {/* Trending Electronics */}
        <section className="bg-[#fffbf7] rounded-3xl p-5 sm:p-6 shadow-xs border border-[#f9bf8f]/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#34222e]">
                Trending Electronics
              </h2>
              <p className="text-xs text-[#7a6274] mt-0.5">
                Popular components ordered for projects and prototyping
              </p>
            </div>

            <button
              onClick={() => onNavigate('catalog')}
              className="text-xs font-bold text-[#e2434b] hover:text-[#c7323a] flex items-center space-x-1 cursor-pointer"
            >
              <span>See all</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {trendingProducts.map((product) => {
              const inCart = cart.find(item => item.product.id === product.id)?.quantity || 0;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={onSelectProduct}
                  onAddToCart={onAddToCart}
                  onQuickView={onQuickView}
                  cartQuantity={inCart}
                />
              );
            })}
          </div>
        </section>

        {/* Development Boards Section */}
        {devBoards.length > 0 && (
          <section className="bg-[#fffbf7] rounded-3xl p-5 sm:p-6 shadow-xs border border-[#f9bf8f]/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#34222e]">
                  Development Boards & Microcontrollers
                </h2>
                <p className="text-xs text-[#7a6274] mt-0.5">
                  ESP32, Raspberry Pi, Arduino, and STM32 boards
                </p>
              </div>

              <button
                onClick={() => {
                  onSelectCategory('Development Boards');
                  onNavigate('catalog');
                }}
                className="text-xs font-bold text-[#e2434b] hover:text-[#c7323a] flex items-center space-x-1 cursor-pointer"
              >
                <span>View Boards</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {devBoards.map((product) => {
                const inCart = cart.find(item => item.product.id === product.id)?.quantity || 0;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                    onAddToCart={onAddToCart}
                    onQuickView={onQuickView}
                    cartQuantity={inCart}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Sensors & Motors Section */}
        {sensorsAndMotors.length > 0 && (
          <section className="bg-[#fffbf7] rounded-3xl p-5 sm:p-6 shadow-xs border border-[#f9bf8f]/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#34222e]">
                  Sensors & Motors
                </h2>
                <p className="text-xs text-[#7a6274] mt-0.5">
                  High-accuracy modules and geared motors
                </p>
              </div>

              <button
                onClick={() => {
                  onSelectCategory('Sensors & Modules');
                  onNavigate('catalog');
                }}
                className="text-xs font-bold text-[#e2434b] hover:text-[#c7323a] flex items-center space-x-1 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {sensorsAndMotors.map((product) => {
                const inCart = cart.find(item => item.product.id === product.id)?.quantity || 0;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                    onAddToCart={onAddToCart}
                    onQuickView={onQuickView}
                    cartQuantity={inCart}
                  />
                );
              })}
            </div>
          </section>
        )}
      </main>

    </div>
  );
};
