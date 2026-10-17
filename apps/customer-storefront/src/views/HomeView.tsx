'use client';

import React from 'react';
import type { HomeSection } from '@spaceborn/web-core/storefront';
import { Product, AppView } from '../types';
import { ProductCard } from '../components/ProductCard';
import { HeroSlider } from '../components/HeroSlider';
import { CategoryIcon } from '../components/CategoryIcon';
import { useStorefront } from '../context/StorefrontConfig';
import { ArrowRight, ChevronRight, Cable, Package } from 'lucide-react';

interface HomeViewProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number) => void;
  onQuickView: (product: Product) => void;
  onSelectCategory: (category: string) => void;
  onNavigate: (view: AppView) => void;
  cart: { product: Product; quantity: number }[];
}

// Tile colours cycle by position so any set of categories reads as a varied, tidy grid.
const TILE_COLOURS = [
  { color: '#0369a1', bg: '#E0F2FE' },
  { color: '#047857', bg: '#ECFDF5' },
  { color: '#b45309', bg: '#FEF3C7' },
  { color: '#b91c1c', bg: '#FEE2E2' },
  { color: '#6d28d9', bg: '#EDE9FE' },
  { color: '#c2410c', bg: '#FFEDD5' },
  { color: '#be185d', bg: '#FCE7F3' },
  { color: '#0f766e', bg: '#CCFBF1' },
];

const SECTION_CARD = 'bg-sb-card rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-xs border border-sb-line/60';

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  onSelectProduct,
  onAddToCart,
  onQuickView,
  onSelectCategory,
  onNavigate,
  cart,
}) => {
  const { settings, categories, inCategory } = useStorefront();
  const sections = settings?.home.sections.filter((s) => s.visible) ?? [];

  const productGrid = (list: Product[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {list.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={onSelectProduct}
          onAddToCart={onAddToCart}
          onQuickView={onQuickView}
          cartQuantity={cart.find((item) => item.product.id === product.id)?.quantity || 0}
        />
      ))}
    </div>
  );

  const sectionHeader = (section: HomeSection, linkLabel: string, onClick: () => void) => (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-sb-ink">{section.title}</h2>
        {section.subtitle && <p className="text-xs text-sb-muted mt-0.5">{section.subtitle}</p>}
      </div>
      <button
        onClick={onClick}
        className="text-xs font-bold text-[#e2434b] hover:text-[#c7323a] flex items-center space-x-1 cursor-pointer shrink-0"
      >
        <span>{linkLabel}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  const renderSection = (section: HomeSection) => {
    if (section.type === 'categories') {
      return (
        <section key={section.id} className={SECTION_CARD}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-bold text-sb-ink">{section.title || 'Shop by Category'}</h2>
            <button
              onClick={() => onNavigate('catalog')}
              className="text-xs font-bold text-[#e2434b] hover:text-[#c7323a] flex items-center space-x-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5 sm:gap-3">
            {categories.map((cat, index) => {
              const tile = TILE_COLOURS[index % TILE_COLOURS.length]!;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.name)}
                  className="group flex flex-col items-center text-center p-1 sm:p-2 rounded-2xl hover:bg-sb-canvas/40 border border-transparent hover:border-sb-line/50 transition-all cursor-pointer"
                >
                  <div
                    style={{ backgroundColor: tile.bg }}
                    className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl border border-black/5 flex items-center justify-center group-hover:scale-105 transition-all shadow-xs mb-1.5 sm:mb-2"
                  >
                    <CategoryIcon icon={cat.icon} className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: tile.color }} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium text-sb-ink leading-tight group-hover:text-[#e2434b] transition-colors line-clamp-2 break-words">
                    {cat.name}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onNavigate('catalog')}
              className="group flex flex-col items-center text-center p-1 sm:p-2 rounded-2xl hover:bg-sb-canvas/40 border border-transparent hover:border-sb-line/50 transition-all cursor-pointer"
            >
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl border border-black/5 bg-[#FCE7F3] flex items-center justify-center group-hover:scale-105 transition-all shadow-xs mb-1.5 sm:mb-2">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-[#be185d]" />
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-sb-ink leading-tight line-clamp-2">All Items</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('fabrication')}
              className="group flex flex-col items-center text-center p-1 sm:p-2 rounded-2xl hover:bg-sb-canvas/40 border border-transparent hover:border-sb-line/50 transition-all cursor-pointer"
            >
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl border border-black/5 bg-sb-ink flex items-center justify-center group-hover:scale-105 transition-all shadow-xs mb-1.5 sm:mb-2">
                <Cable className="w-5 h-5 sm:w-6 sm:h-6 text-[#f8cb46]" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-sb-ink leading-tight line-clamp-1">Print request</span>
            </button>
          </div>
        </section>
      );
    }

    if (section.type === 'trending') {
      const trending = products.slice(0, 16);
      if (trending.length === 0) return null;
      return (
        <section key={section.id} className={SECTION_CARD}>
          {sectionHeader({ ...section, title: section.title || 'Trending Electronics' }, 'See all', () => onNavigate('catalog'))}
          {productGrid(trending)}
        </section>
      );
    }

    const category = categories.find((c) => c.id === section.categoryId);
    if (!category) return null;
    const rail = products.filter((p) => inCategory(p, category.id)).slice(0, 8);
    if (rail.length === 0) return null;
    return (
      <section key={section.id} className={SECTION_CARD}>
        {sectionHeader({ ...section, title: section.title || category.name }, 'View all', () => onSelectCategory(category.name))}
        {productGrid(rail)}
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-sb-canvas text-sb-ink pb-24">
      <main className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-6 space-y-4 sm:space-y-6">
        <HeroSlider onNavigate={onNavigate} onSelectCategory={onSelectCategory} />
        {sections.map(renderSection)}
      </main>
    </div>
  );
};
