'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { CATEGORIES, matchCategory, isCategoryActive } from '../data/products';
import { useStore } from '../context/StoreContext';
import { 
  SlidersHorizontal, 
  ChevronRight, 
  Grid, 
  List, 
  RotateCcw, 
  Search, 
  ShoppingCart, 
  Star,
  LayoutGrid,
  Zap,
  Cpu,
  Compass,
  Battery,
  Flame,
  Layers,
  Box,
  ShieldCheck,
  Wrench,
  X
} from 'lucide-react';

interface CatalogViewProps {
  products: Product[];
  onSelectProduct: (p: Product) => void;
  onAddToCart: (p: Product, qty?: number) => void;
  onQuickView: (p: Product) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange?: (q: string) => void;
  onClearSearch?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'All Categories': <LayoutGrid className="w-4 h-4" />,
  'Dev Boards & MCUs': <Cpu className="w-4 h-4" />,
  'Development Boards': <Cpu className="w-4 h-4" />,
  'Sensors & Modules': <Compass className="w-4 h-4" />,
  'Motors & Drivers': <Zap className="w-4 h-4" />,
  'Batteries & Power': <Battery className="w-4 h-4" />,
  'Batteries & Chargers': <Battery className="w-4 h-4" />,
  'DIY Kits': <Flame className="w-4 h-4" />,
  '3D Printing & CNC': <Layers className="w-4 h-4" />,
  'Robotics & Mechanical': <Box className="w-4 h-4" />,
  'Mechanical & Frames': <Box className="w-4 h-4" />,
  'Components & Hardware': <ShieldCheck className="w-4 h-4" />,
  'Components': <ShieldCheck className="w-4 h-4" />,
  'Tools & Soldering': <Wrench className="w-4 h-4" />,
  'Tools & Accessories': <Wrench className="w-4 h-4" />,
};

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  onSelectProduct,
  onAddToCart,
  onQuickView,
  selectedCategory,
  onSelectCategory,
  searchQuery: initialSearchQuery,
  onSearchChange,
  onClearSearch,
}) => {
  const { searchResults, searchStatus, catalogStatus } = useStore();
  // Server results are already ranked by relevance; the local token filter is only a fallback.
  const serverRanked = initialSearchQuery.trim().length > 1 && searchResults !== null;

  // Filter state
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedVoltages, setSelectedVoltages] = useState<string[]>([]);
  const [selectedRpms, setSelectedRpms] = useState<string[]>([]);
  const [selectedShaft, setSelectedShaft] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating'>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const handleClearSearch = () => {
    if (onClearSearch) {
      onClearSearch();
    } else if (onSearchChange) {
      onSearchChange('');
      onSelectCategory('All Categories');
    } else {
      onSelectCategory('All Categories');
    }
    setSelectedSubCategory('All');
  };

  // When a new search query is initiated, search across entire catalog by default
  const prevSearchRef = useRef(initialSearchQuery);
  useEffect(() => {
    if (initialSearchQuery !== prevSearchRef.current) {
      prevSearchRef.current = initialSearchQuery;
      if (initialSearchQuery.trim().length > 0 && selectedCategory !== 'All Categories') {
        onSelectCategory('All Categories');
      }
      setSelectedSubCategory('All');
    }
  }, [initialSearchQuery, selectedCategory, onSelectCategory]);

  // Dynamic category product counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Categories': products.length };
    CATEGORIES.forEach(cat => {
      if (cat.id === 'all') {
        counts[cat.name] = products.length;
      } else {
        counts[cat.name] = products.filter(p => matchCategory(p.category, cat.name)).length;
      }
    });
    return counts;
  }, [products]);

  // Contextual subcategories for the selected category
  const availableSubCategories = useMemo(() => {
    const subs = new Set<string>();
    products.forEach(p => {
      if (selectedCategory === 'All Categories' || selectedCategory === 'all' || matchCategory(p.category, selectedCategory)) {
        if (p.subCategory) subs.add(p.subCategory);
      }
    });
    return Array.from(subs);
  }, [products, selectedCategory]);

  // Available filter options derived from products
  const availableVoltages = ['5V', '6V', '12V', '24V'];
  const availableRpms = ['100 RPM', '300 RPM', '330 RPM', '12000 RPM'];
  const availableShafts = ['3mm D-Shaft', '6mm D-Shaft', '5mm Round Shaft'];

  const toggleFilter = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(x => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const clearAllFilters = () => {
    setSelectedSubCategory('All');
    setInStockOnly(false);
    setSelectedVoltages([]);
    setSelectedRpms([]);
    setSelectedShaft([]);
    setMaxPrice(10000);
  };

  const hasActiveFilters = 
    selectedSubCategory !== 'All' ||
    inStockOnly ||
    selectedVoltages.length > 0 ||
    selectedRpms.length > 0 ||
    selectedShaft.length > 0 ||
    maxPrice < 10000;

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const source = serverRanked ? searchResults! : products;
    return source.filter(p => {
      // Category match
      if (selectedCategory !== 'All Categories' && selectedCategory !== 'all') {
        if (!matchCategory(p.category, selectedCategory)) return false;
      }

      // Subcategory match
      if (selectedSubCategory !== 'All') {
        if (p.subCategory !== selectedSubCategory) return false;
      }

      // Local fallback when the server search is unavailable
      if (!serverRanked && initialSearchQuery.trim()) {
        const q = initialSearchQuery.toLowerCase().trim();
        const tokens = q.split(/\s+/).filter(Boolean);

        // Domain-specific robotics & electronics synonyms
        const synonyms: Record<string, string[]> = {
          '3d': ['3d', 'printer', 'filament', 'creality', 'ender', 'resin', 'nozzle', 'pla', 'fdm', 'sla'],
          'cnc': ['cnc', 'laser', 'engraver', 'cutting', 'milling', 'atomstack', 'heatsink', 'drill', 'spindle'],
          'laser': ['laser', 'engraver', 'cutter', 'cnc', 'atomstack'],
          'drone': ['drone', 'motor', 'bldc', 'propeller', 'esc', 'flysky', 'quadcopter', 'hobbywing'],
          'motor': ['motor', 'bldc', 'stepper', 'servo', 'rpm', 'driver', 'torque'],
          'battery': ['battery', 'lipo', 'lithium', 'bms', 'charger', 'mah', 'cell', 'power'],
          'board': ['board', 'mcu', 'arduino', 'esp32', 'raspberry', 'pi', 'microcontroller', 'uno'],
          'sensor': ['sensor', 'module', 'ultrasonic', 'gyro', 'camera', 'lidar', 'distance'],
        };

        const terms = new Set<string>(tokens);
        for (const t of tokens) {
          if (synonyms[t]) {
            synonyms[t].forEach(s => terms.add(s));
          }
        }

        const corpus = `${p.name} ${p.sku} ${p.category} ${p.subCategory || ''} ${p.brand || ''} ${p.description || ''} ${p.voltage || ''} ${p.rpm || ''}`.toLowerCase();

        // Exact substring match
        if (corpus.includes(q)) {
          // match
        } else {
          // Token or synonym match
          const hasMatch = Array.from(terms).some(term => corpus.includes(term));
          if (!hasMatch) return false;
        }
      }

      // In stock
      if (inStockOnly && p.stock <= 0) return false;

      // Price filter
      if (p.price > maxPrice) return false;

      // Voltage filter
      if (selectedVoltages.length > 0) {
        if (!p.voltage || !selectedVoltages.includes(p.voltage)) return false;
      }

      // RPM filter
      if (selectedRpms.length > 0) {
        if (!p.rpm) return false;
        const matchesRpm = selectedRpms.some(r => r.includes(String(p.rpm)));
        if (!matchesRpm) return false;
      }

      // Shaft filter
      if (selectedShaft.length > 0) {
        if (!p.shaftType || !selectedShaft.includes(p.shaftType)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0; // featured default
    });
  }, [
    products, 
    serverRanked,
    searchResults,
    selectedCategory, 
    initialSearchQuery, 
    selectedSubCategory, 
    inStockOnly, 
    selectedVoltages, 
    selectedRpms, 
    selectedShaft, 
    maxPrice, 
    sortBy
  ]);

  const isSearching = initialSearchQuery.trim().length > 0;
  const resultCountLabel =
    searchStatus === 'loading' || catalogStatus === 'loading'
      ? 'Searching…'
      : `${filteredProducts.length} item${filteredProducts.length === 1 ? '' : 's'}`;

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-3 sm:py-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-xs text-[#7a6274] mb-3 sm:mb-4 min-w-0">
          <span 
            onClick={() => onSelectCategory('All Categories')} 
            className="hover:text-[#e2434b] cursor-pointer shrink-0"
          >
            Home
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#7a6274] shrink-0" />
          {isSearching ? (
            <span className="truncate">Search</span>
          ) : (
            <>
              <span className="hover:text-[#e2434b] cursor-pointer truncate">{selectedCategory}</span>
              {selectedSubCategory !== 'All' && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-[#7a6274] shrink-0" />
                  <span className="font-bold text-[#34222e] truncate">{selectedSubCategory}</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Search mode: one compact header instead of banner + category rail + callout */}
        {isSearching && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#34222e] min-w-0 truncate">
              Results for <span className="text-[#0c831f]">“{initialSearchQuery.trim()}”</span>
            </h1>
            <span className="text-xs text-[#7a6274]">{resultCountLabel}</span>
            {selectedCategory !== 'All Categories' && (
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('All Categories');
                  setSelectedSubCategory('All');
                }}
                title="Remove category filter"
                className="inline-flex items-center gap-1 text-[11px] bg-[#fffbf7] border border-[#f9bf8f]/60 text-[#34222e] px-2 py-0.5 rounded-full font-semibold cursor-pointer hover:bg-[#fee9d7]"
              >
                in {selectedCategory}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClearSearch}
              className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#7a6274] hover:text-[#e2434b] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        )}

        {/* Category Header Banner (browsing only) */}
        {!isSearching && (
        <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl border border-[#f9bf8f]/60 p-3.5 sm:p-6 mb-4 sm:mb-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-[#0c831f] mb-1">
                <span>⚡ 10-15 Min Delivery</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#34222e]">
                {selectedCategory === 'All Categories' ? 'All Products' : selectedCategory}
              </h1>
              <p className="text-xs text-[#7a6274] mt-1 max-w-2xl leading-relaxed">
                {selectedCategory === 'All Categories'
                  ? 'Explore genuine microcontrollers, sensors, motors, tools, and accessories ready for fast dispatch.'
                  : `High-reliability ${selectedCategory.toLowerCase()} available for instant lab dispatch.`}
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <span className="text-xs font-bold text-[#0c831f] bg-[#f2fcf4] px-3.5 py-1.5 rounded-xl border border-[#0c831f]/20">
                {filteredProducts.length} Products Available
              </span>
            </div>
          </div>
        </div>
        )}

        {/* Quick-Commerce Category Pills / Chips Rail (browsing only; the sidebar and filters cover this while searching) */}
        {!isSearching && (
        <div className="mb-4 sm:mb-6 bg-[#fffbf7] rounded-2xl sm:rounded-3xl border border-[#f9bf8f]/60 p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-xs font-bold text-[#34222e] flex items-center gap-1.5 uppercase tracking-wider">
              <LayoutGrid className="w-3.5 h-3.5 text-[#0c831f]" />
              <span>Browse Categories</span>
            </span>
            {selectedCategory !== 'All Categories' && (
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('All Categories');
                  setSelectedSubCategory('All');
                }}
                className="text-[11px] font-bold text-[#e2434b] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Show All Categories</span>
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
            {CATEGORIES.map((cat) => {
              const isActive = isCategoryActive(cat.name, selectedCategory);
              const count = categoryCounts[cat.name] ?? 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (isActive && cat.id !== 'all') {
                      onSelectCategory('All Categories');
                    } else {
                      onSelectCategory(cat.name);
                    }
                    setSelectedSubCategory('All');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 select-none ${
                    isActive
                      ? 'bg-[#0c831f] text-white shadow-xs font-bold'
                      : 'bg-[#fee9d7]/50 hover:bg-[#fee9d7] border border-[#f9bf8f]/60 text-[#34222e]'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-[#e2434b]'}>
                    {CATEGORY_ICONS[cat.name] || <Box className="w-3.5 h-3.5" />}
                  </span>
                  <span>{cat.name}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#fffbf7] text-[#7a6274] border border-[#f9bf8f]/40'
                    }`}>
                      {count}
                    </span>
                  )}
                  {isActive && cat.id !== 'all' && (
                    <X className="w-3 h-3 ml-0.5 text-white/80 hover:text-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Catalog Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Category & Filter Sidebar (Desktop) */}
          <aside className="hidden lg:block lg:col-span-3 space-y-4">
            
            {/* Categories Vertical Aisles */}
            <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-4 shadow-xs text-[#34222e] space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#f9bf8f]/40 px-1">
                <span className="text-xs font-black uppercase tracking-wider text-[#34222e] flex items-center space-x-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-[#e2434b]" />
                  <span>Categories</span>
                </span>
                <span className="text-[10px] font-bold text-[#059669] bg-[#ecfdf5] px-2 py-0.5 rounded-full border border-[#059669]/20">
                  {products.length} Items
                </span>
              </div>

              {/* Vertical Category Aisles */}
              <div className="space-y-1">
                {CATEGORIES.map((cat) => {
                  const isActive = isCategoryActive(cat.name, selectedCategory);
                  const count = categoryCounts[cat.name] || 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        if (isActive && cat.id !== 'all') {
                          onSelectCategory('All Categories');
                        } else {
                          onSelectCategory(cat.name);
                        }
                        setSelectedSubCategory('All');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[#059669] text-white shadow-xs font-bold'
                          : 'text-[#34222e] hover:bg-[#fee9d7]/70 font-semibold'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className={`shrink-0 ${isActive ? 'text-white' : 'text-[#e2434b]'}`}>
                          {CATEGORY_ICONS[cat.name] || <Box className="w-4 h-4" />}
                        </span>
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-[#fee9d7] text-[#7a6274]'
                        }`}>
                          {count}
                        </span>
                        {isActive && cat.id !== 'all' && (
                          <X className="w-3 h-3 text-white/80 hover:text-white" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Subcategories Shelf (if selected category has subcategories) */}
              {availableSubCategories.length > 0 && (
                <div className="pt-2.5 border-t border-[#f9bf8f]/40 space-y-1.5 px-1">
                  <span className="text-[10px] font-bold text-[#7a6274] block uppercase tracking-wider">
                    Types & Subcategories
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedSubCategory('All')}
                      className={`px-2 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                        selectedSubCategory === 'All'
                          ? 'bg-[#0c831f] text-white shadow-xs'
                          : 'bg-white text-[#7a6274] hover:text-[#34222e] border border-[#f9bf8f]/60'
                      }`}
                    >
                      All
                    </button>
                    {availableSubCategories.map(sub => (
                      <button
                        key={sub}
                        onClick={() => setSelectedSubCategory(sub)}
                        className={`px-2 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                          selectedSubCategory === sub
                            ? 'bg-[#0c831f] text-white shadow-xs'
                            : 'bg-white text-[#7a6274] hover:text-[#34222e] border border-[#f9bf8f]/60'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filter Options Block */}
            <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-4 sm:p-5 shadow-xs space-y-4 text-[#34222e]">
              <div className="flex items-center justify-between pb-2 border-b border-[#f9bf8f]/40">
                <span className="text-xs font-black uppercase tracking-wider text-[#34222e] flex items-center space-x-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#0c831f]" />
                  <span>Filters</span>
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-[11px] font-semibold text-[#e2434b] hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* In Stock Availability Checkbox */}
              <div>
                <label className="flex items-center space-x-2 text-xs font-semibold text-[#34222e] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0c831f] focus:ring-[#0c831f] accent-[#0c831f] cursor-pointer"
                  />
                  <span>In-Stock Only</span>
                </label>
              </div>

              {/* Price Range Slider */}
              <div className="space-y-2 pt-3 border-t border-[#f9bf8f]/40">
                <div className="flex items-center justify-between text-xs font-semibold text-[#34222e]">
                  <span>Max Price:</span>
                  <span className="font-bold text-[#34222e]">₹{maxPrice.toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="10000"
                  step="50"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                  className="w-full accent-[#0c831f] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#7a6274]">
                  <span>₹50</span>
                  <span>₹10,000</span>
                </div>
              </div>

              {/* Operating Voltage */}
              <div className="space-y-2 pt-3 border-t border-[#f9bf8f]/40">
                <span className="text-xs font-bold text-[#34222e] block">Operating Voltage</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {availableVoltages.map(v => (
                    <label key={v} className="flex items-center space-x-1.5 text-xs text-[#7a6274] hover:text-[#34222e] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedVoltages.includes(v)}
                        onChange={() => toggleFilter(selectedVoltages, setSelectedVoltages, v)}
                        className="w-3.5 h-3.5 rounded text-[#0c831f] focus:ring-[#0c831f] accent-[#0c831f]"
                      />
                      <span>{v} DC</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>

          </aside>

          {/* Right Product Grid Column */}
          <main className="lg:col-span-9 space-y-4">
            
            {/* Controls Bar: filters (phone/tablet), sort, view. The count lives in the page header. */}
            <div className="bg-[#fffbf7] rounded-2xl border border-[#f9bf8f]/60 p-2.5 sm:p-3.5 flex items-center justify-between gap-2 shadow-xs">
              
              <div className="flex items-center gap-2 min-w-0">
                {/* Mobile Filter Toggle */}
                <button
                  onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                  className="lg:hidden flex items-center space-x-1.5 text-xs font-bold text-[#34222e] bg-white px-3 py-1.5 rounded-xl border border-[#f9bf8f]/60 cursor-pointer shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#e2434b]" />
                  <span>Filters{hasActiveFilters ? ' •' : ''}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Sort Dropdown */}
                <div className="flex items-center space-x-1.5 text-xs">
                  <span className="text-[#7a6274] hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white border border-[#f9bf8f]/60 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#34222e] outline-none cursor-pointer"
                  >
                    <option value="featured">Featured</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating">Top Rated</option>
                  </select>
                </div>

                {/* View Switcher */}
                <div className="flex items-center border border-[#f9bf8f]/60 rounded-xl overflow-hidden bg-white">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 transition cursor-pointer ${
                      viewMode === 'grid' ? 'bg-[#fee9d7] text-[#e2434b]' : 'text-[#7a6274] hover:text-[#34222e]'
                    }`}
                    title="Grid View"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 transition cursor-pointer ${
                      viewMode === 'list' ? 'bg-[#fee9d7] text-[#e2434b]' : 'text-[#7a6274] hover:text-[#34222e]'
                    }`}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

              </div>

            </div>

            {/* Mobile Filters Drawer if open */}
            {mobileFilterOpen && (
              <div className="lg:hidden bg-[#fffbf7] p-4 rounded-2xl border border-[#f9bf8f]/60 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#f9bf8f]/40">
                  <span className="text-xs font-bold text-[#34222e]">Filter Options</span>
                  <button onClick={clearAllFilters} className="text-xs font-bold text-[#e2434b]">Clear All</button>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {availableVoltages.map(v => (
                    <button
                      key={v}
                      onClick={() => toggleFilter(selectedVoltages, setSelectedVoltages, v)}
                      className={`px-2.5 py-1 rounded-lg border text-xs ${
                        selectedVoltages.includes(v) ? 'bg-[#0c831f] text-white border-[#0c831f]' : 'bg-white border-[#f9bf8f]/60 text-[#34222e]'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <label className="flex items-center space-x-2 text-xs font-bold text-[#34222e]">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0c831f] accent-[#0c831f]"
                  />
                  <span>In-Stock Only</span>
                </label>
              </div>
            )}

            {/* Products Listing */}
            {filteredProducts.length === 0 ? (
              <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#fee9d7] mx-auto flex items-center justify-center text-[#e2434b]">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#34222e]">
                  {catalogStatus === 'loading'
                    ? 'Loading products near you'
                    : catalogStatus === 'error'
                      ? 'Could not load products'
                      : catalogStatus === 'unserviceable'
                        ? 'No store delivers here yet'
                        : 'No products found'}
                </h3>
                <p className="text-xs text-[#7a6274] max-w-sm mx-auto">
                  {catalogStatus === 'loading'
                    ? 'Checking stock at stores around your location…'
                    : catalogStatus === 'error'
                    ? 'Check your connection and try again in a moment.'
                    : catalogStatus === 'unserviceable'
                      ? 'Try a different delivery location from the header.'
                      : initialSearchQuery.trim()
                    ? `No components or hardware found matching "${initialSearchQuery}".`
                    : 'Try adjusting your filters or price range to find matching components.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {initialSearchQuery.trim() && catalogStatus !== 'loading' && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0c831f] hover:bg-[#0a6e1a] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear Search Query</span>
                    </button>
                  )}
                  {selectedCategory !== 'All Categories' && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory('All Categories');
                        setSelectedSubCategory('All');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#f9bf8f]/70 hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Show All Categories</span>
                    </button>
                  )}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#f9bf8f]/70 hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Filters</span>
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                    onAddToCart={onAddToCart}
                    onQuickView={onQuickView}
                  />
                ))}
              </div>
            ) : (
              /* List View Mode */
              <div className="space-y-3">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => onSelectProduct(product)}
                    className="bg-[#fffbf7] rounded-2xl border border-[#f9bf8f]/60 p-3 sm:p-4 hover:border-[#0c831f] hover:shadow-sm transition-all flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 cursor-pointer text-[#34222e]"
                  >
                    <div className="flex items-center space-x-4 w-full sm:w-auto">
                      <div className="w-20 h-20 rounded-xl bg-white border border-[#f9bf8f]/40 p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 text-[10px] text-[#7a6274] mb-0.5">
                          <span className="font-semibold text-[#e2434b]">{product.brand}</span>
                          <span>•</span>
                          <span>SKU: {product.sku}</span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-[#34222e] leading-snug">
                          {product.name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1 text-xs">
                          <div className="flex text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-bold text-[#34222e]">{product.rating}</span>
                          <span className="text-[10px] text-[#0c831f] font-semibold bg-[#f2fcf4] px-1.5 py-0.5 rounded border border-[#0c831f]/20">
                            ⚡ {product.deliveryMins || 10} Mins
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f9bf8f]/40 gap-2">
                      <div className="text-left sm:text-right">
                        <span className="text-base font-bold text-[#34222e]">
                          ₹{product.price.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-[#7a6274] block">
                          Incl. 18% GST
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCart(product, 1);
                        }}
                        className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1.5"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Add to Cart</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </main>

        </div>

      </div>
    </div>
  );
};
