'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Product, CartItem, UserProfile, AppView } from '../types';
import { SpacebornLogo } from './SpacebornLogo';
import { 
  Search, 
  ShoppingCart, 
  Heart, 
  User, 
  ChevronDown,
  X,
  LogOut,
  Settings,
  MapPin,
  Receipt,
  Store,
  ShieldCheck,
  LayoutDashboard,
  Wrench,
  PhoneCall
} from 'lucide-react';

interface HeaderProps {
  cart: CartItem[];
  wishlistCount: number;
  compareCount?: number;
  user: UserProfile | null;
  onOpenCart: () => void;
  onOpenAuth: (mode?: 'login' | 'signup') => void;
  onSignOut: () => void;
  onNavigate: (view: AppView) => void;
  currentView: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  products: Product[];
  onSelectProduct: (p: Product) => void;
}

import { LOCATION_PRESETS, useStore, type DeliveryLocation } from '../context/StoreContext';

export const Header: React.FC<HeaderProps> = ({
  cart,
  wishlistCount,
  user,
  onOpenCart,
  onOpenAuth,
  onSignOut,
  onNavigate,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  products,
  onSelectProduct,
}) => {
  const { location, setLocation, locateMe, locateByPincode, searchPlaces, serviceArea, catalogStatus, searchResults: rankedResults } =
    useStore();
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateBusy, setLocateBusy] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<DeliveryLocation[]>([]);
  const deliveryLabel =
    catalogStatus === 'loading'
      ? 'Checking delivery here…'
      : serviceArea.etaMinutes
        ? `Delivery in about ${serviceArea.etaMinutes} mins`
        : 'Not serviceable here yet';

  const submitPlace = async () => {
    const q = placeQuery.trim();
    if (!q) return;
    setLocateError(null);
    setLocateBusy(true);
    try {
      if (/^\d{6}$/.test(q)) {
        await locateByPincode(q);
        setShowLocationModal(false);
        setPlaceQuery('');
        setPlaceResults([]);
      } else {
        const results = await searchPlaces(q);
        setPlaceResults(results);
        if (!results.length) setLocateError('No matching place found. Try a PIN code or a landmark.');
      }
    } catch (err) {
      setLocateError((err as Error).message);
    } finally {
      setLocateBusy(false);
    }
  };
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const handleClearDesktopSearch = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onSearchChange('');
    setShowSearchDropdown(false);
    searchInputRef.current?.focus();
  };

  const handleClearMobileSearch = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onSearchChange('');
    mobileSearchInputRef.current?.focus();
  };

  const handlePerformSearch = (explicitQuery?: string) => {
    const q = explicitQuery !== undefined ? explicitQuery : searchQuery;
    setShowSearchDropdown(false);
    if (q.trim()) {
      if (onSelectCategory && selectedCategory !== 'All Categories') {
        onSelectCategory('All Categories');
      }
    }
    onNavigate('catalog');
  };

  // Cycling search placeholder like Blinkit
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholders = [
    'Search "arduino, esp32..."',
    'Search "soldering iron, flux..."',
    'Search "lipo battery, bms..."',
    'Search "servo motors, sensors..."',
    'Search "resistors, breadboard..."',
    'Search "raspberry pi, camera..."'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [placeholders.length]);

  // ⌘K keyboard shortcut support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const [isCartBumping, setIsCartBumping] = useState(false);
  const prevCartCountRef = useRef(cartItemsCount);

  useEffect(() => {
    if (cartItemsCount !== prevCartCountRef.current) {
      prevCartCountRef.current = cartItemsCount;
      if (cartItemsCount > 0) {
        setIsCartBumping(true);
        const t = setTimeout(() => setIsCartBumping(false), 400);
        return () => clearTimeout(t);
      }
    }
  }, [cartItemsCount]);

  const searchResults = searchQuery.trim().length > 1
    ? (rankedResults ?? products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )).slice(0, 5)
    : [];

  return (
    <header className="sticky top-0 z-50 bg-[#fffbf7] border-b border-[#f9bf8f]/60 shadow-xs transition-all">

      {/* Main Clean Header */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 md:gap-6 min-w-0">
          
          {/* Brand Logo & Location Switcher */}
          <div className="flex items-center space-x-1.5 sm:space-x-5 shrink min-w-0">
            {/* Spaceborn Brand Logo (reduced size) */}
            <div 
              onClick={() => onNavigate('home')} 
              className="cursor-pointer shrink min-w-0 mr-1 sm:mr-2 hover:opacity-90 active:scale-98 transition-all"
              title="Spaceborn"
            >
              <SpacebornLogo size="sm" subtitle={false} />
            </div>

            {/* Delivery Location Selector (tablet and up; phones get a chip in the search row) */}
            <div 
              onClick={() => setShowLocationModal(true)}
              className="hidden md:flex flex-col text-left cursor-pointer group pl-2 sm:pl-3 border-l border-[#f9bf8f]/60"
            >
              <div className="flex items-center space-x-1 text-[#059669] font-bold text-xs">
                <span>{deliveryLabel}</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-[#34222e]/80 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#e2434b]" />
                <span className="truncate max-w-[170px]">{location.area}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#34222e]/60 group-hover:translate-y-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Minimalist Search Bar with Semantic Enter Key Navigation */}
          <div className="relative flex-1 max-w-xl hidden md:block">
            <div className="flex items-center rounded-xl bg-[#fee9d7]/50 border border-[#f9bf8f]/70 hover:bg-[#fffbf7] focus-within:bg-white focus-within:border-[#059669] focus-within:ring-2 focus-within:ring-[#059669]/10 transition-all overflow-hidden px-3.5 py-2">
              <Search className="w-4 h-4 text-[#7a6274] mr-2.5 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePerformSearch();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleClearDesktopSearch();
                  }
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder={placeholders[placeholderIndex]}
                className="w-full bg-transparent text-xs sm:text-sm text-[#34222e] placeholder:text-[#7a6274]/70 outline-none font-medium"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {searchQuery ? (
                  <>
                    <button 
                      type="button"
                      onClick={handleClearDesktopSearch}
                      aria-label="Clear search"
                      title="Clear search (Esc)"
                      className="p-1 text-[#7a6274] hover:text-[#34222e] hover:bg-[#fee9d7] rounded-full cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePerformSearch()}
                      title="Search catalog"
                      className="px-2.5 py-0.5 rounded-lg bg-[#0c831f] hover:bg-[#0a6e1a] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
                    >
                      <span>Search</span>
                      <kbd className="font-mono text-[9px] text-white/80">↵</kbd>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePerformSearch()}
                    title="Search catalog"
                    className="px-2 py-0.5 rounded bg-white hover:bg-[#fee9d7]/50 border border-[#f9bf8f]/60 text-[#7a6274] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>Search</span>
                    <kbd className="font-mono text-[9px] text-[#7a6274]/70">↵</kbd>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Search Autocomplete Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div 
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-[#f9bf8f]/60 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                onMouseLeave={() => setShowSearchDropdown(false)}
              >
                <div className="px-4 py-1.5 text-[11px] font-bold text-[#7a6274] border-b border-[#f9bf8f]/30 flex items-center justify-between">
                  <span>Search Suggestions</span>
                  <span className="text-[#0c831f] font-semibold">10-15 Min Delivery</span>
                </div>
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onSelectProduct(p);
                      setShowSearchDropdown(false);
                    }}
                    className="px-4 py-2 hover:bg-[#fee9d7]/50 flex items-center justify-between cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-[#fffbf7] border border-[#f9bf8f]/40 flex items-center justify-center p-1">
                        <img src={p.image} alt={p.name} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#34222e] line-clamp-1 group-hover:text-[#e2434b]">{p.name}</p>
                        <p className="text-[10px] text-[#7a6274]">SKU: {p.sku}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#34222e] bg-[#fee9d7] px-2 py-1 rounded-md">
                      ₹{p.price}
                    </span>
                  </div>
                ))}
                <div
                  onClick={() => handlePerformSearch()}
                  className="px-4 py-2 border-t border-[#f9bf8f]/30 text-xs font-bold text-[#0c831f] hover:bg-[#fee9d7]/40 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Search entire catalog for &ldquo;{searchQuery}&rdquo;</span>
                  <span className="text-[#7a6274] font-mono text-[10px]">↵</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0">
            
            {/* Orders Action */}
            <button 
              onClick={() => onNavigate('orders')}
              aria-label="Orders"
              title="Orders"
              className="inline-flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto p-1.5 sm:px-3 sm:py-2 rounded-xl border border-[#f9bf8f]/60 bg-[#fffbf7] hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7a6274]" />
              <span className="hidden sm:inline">Orders</span>
            </button>

            {/* Account Profile Icon */}
            <div className="relative shrink-0">
              {user ? (
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  aria-label="Account menu"
                  className="flex items-center space-x-1 sm:space-x-2 text-[#34222e] p-0.5 sm:p-1 rounded-xl hover:bg-[#fee9d7]/50 transition cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#34222e] text-[#fee9d7] font-bold text-xs flex items-center justify-center">
                    {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left hidden lg:block pr-1">
                    <span className="text-xs font-bold text-[#34222e] flex items-center">
                      {user.fullName.split(' ')[0]} <ChevronDown className="w-3 h-3 ml-1 text-[#7a6274]" />
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => onOpenAuth('login')}
                  aria-label="Sign in"
                  title="Sign in"
                  className="inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-[#34222e] hover:bg-[#1a0f16] text-[#fee9d7] w-8 h-8 sm:w-auto sm:h-auto px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-95 shrink-0"
                >
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f8cb46]" />
                  <span className="hidden sm:inline">Sign In / Google</span>
                </button>
              )}

              {/* Account Dropdown */}
              {showAccountMenu && user && (
                <div 
                  className="absolute right-0 top-full mt-2 w-56 bg-[#fffbf7] rounded-2xl shadow-xl border border-[#f9bf8f]/60 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onMouseLeave={() => setShowAccountMenu(false)}
                >
                  <div className="px-3 py-2 bg-[#fee9d7] rounded-xl border border-[#f9bf8f]/50 mb-1.5">
                    <p className="text-xs font-bold text-[#34222e]">{user.fullName}</p>
                    <p className="text-[10px] text-[#7a6274] truncate">{user.email}</p>
                  </div>

                  <div className="space-y-0.5">
                    <button onClick={() => { onNavigate('profile'); setShowAccountMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fee9d7]/50 flex items-center space-x-2.5 text-[#34222e] text-xs font-semibold cursor-pointer transition">
                      <LayoutDashboard className="w-3.5 h-3.5 text-[#0c831f]" /> <span>Account Dashboard</span>
                    </button>
                    <button onClick={() => { onNavigate('orders'); setShowAccountMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fee9d7]/50 flex items-center space-x-2.5 text-[#34222e] text-xs font-semibold cursor-pointer transition">
                      <Receipt className="w-3.5 h-3.5 text-[#34222e]" /> <span>My Orders</span>
                    </button>
                    <button onClick={() => { onNavigate('wishlist'); setShowAccountMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fee9d7]/50 flex items-center space-x-2.5 text-[#34222e] text-xs font-semibold cursor-pointer transition">
                      <Heart className="w-3.5 h-3.5 text-[#e2434b]" /> <span>Saved Wishlist ({wishlistCount})</span>
                    </button>
                    <button onClick={() => { onNavigate('fabrication'); setShowAccountMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fee9d7]/50 flex items-center space-x-2.5 text-[#34222e] text-xs font-semibold cursor-pointer transition">
                      <Wrench className="w-3.5 h-3.5 text-[#ca8a04]" /> <span>3D Printing & CNC Lab</span>
                    </button>
                    <button onClick={() => { onNavigate('contact'); setShowAccountMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fee9d7]/50 flex items-center space-x-2.5 text-[#34222e] text-xs font-semibold cursor-pointer transition">
                      <PhoneCall className="w-3.5 h-3.5 text-[#7a6274]" /> <span>Help & Support</span>
                    </button>
                  </div>
                  
                  <div className="mt-1.5 pt-1.5 border-t border-[#f9bf8f]/30">
                    <button onClick={() => { onSignOut(); setShowAccountMenu(false); }} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 text-[#e2434b] flex items-center space-x-2.5 text-xs font-bold transition cursor-pointer">
                      <LogOut className="w-3.5 h-3.5" /> <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Blinkit Green Cart Button */}
            <button
              onClick={onOpenCart}
              aria-label={cartItemsCount > 0 ? `Cart, ${cartItemsCount} items` : 'Cart'}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 ${
                cartItemsCount > 0 ? 'h-8 px-2.5 sm:h-auto sm:px-4' : 'w-8 h-8 sm:w-auto sm:h-auto sm:px-4'
              } py-1.5 sm:py-2 rounded-xl bg-[#0c831f] hover:bg-[#0a6e1a] text-white font-bold text-xs sm:text-sm shadow-sm transition-all duration-150 active:scale-[0.96] cursor-pointer shrink-0 ${
                isCartBumping ? 'animate-badge-bump ring-2 ring-[#0c831f]/40' : ''
              }`}
            >
              <ShoppingCart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${isCartBumping ? 'scale-125' : ''}`} />
              {/* Phones: live item count badge when items > 0. Desktop: full text and subtotal */}
              {cartItemsCount > 0 && (
                <span className="font-mono font-bold text-xs sm:hidden">{cartItemsCount}</span>
              )}
              <span className="hidden sm:inline">{cartItemsCount > 0 ? `${cartItemsCount} items` : 'Cart'}</span>
              {cartItemsCount > 0 && (
                <>
                  <span className="hidden sm:inline text-white/60 text-xs">•</span>
                  <span className="hidden sm:inline font-bold text-xs text-white">
                    ₹{cartSubtotal.toLocaleString('en-IN')}
                  </span>
                </>
              )}
            </button>

          </div>

        </div>

        {/* Mobile: delivery location chip + search bar */}
        <div className="mt-1.5 block md:hidden space-y-1.5">
          <button
            type="button"
            onClick={() => setShowLocationModal(true)}
            className="flex w-full items-center gap-1 text-left cursor-pointer min-w-0 py-0.5"
          >
            <MapPin className="w-3.5 h-3.5 text-[#e2434b] shrink-0" />
            <span className="text-xs font-bold text-[#34222e] truncate max-w-[45%]">{location.area}</span>
            <ChevronDown className="w-3 h-3 text-[#34222e]/60 shrink-0" />
            <span className="ml-auto text-[10.5px] font-bold text-[#059669] truncate shrink-0 max-w-[50%]">{deliveryLabel}</span>
          </button>
          <div className="relative">
            <div className="flex items-center rounded-xl bg-[#fee9d7]/50 border border-[#f9bf8f]/70 px-2.5 py-1.5 focus-within:bg-white focus-within:border-[#059669] transition-all">
              <Search className="w-3.5 h-3.5 text-[#7a6274] mr-2 shrink-0" />
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePerformSearch();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleClearMobileSearch();
                  }
                }}
                placeholder="Search components, sensors, motors..."
                className="w-full bg-transparent text-xs text-[#34222e] placeholder:text-[#7a6274]/70 outline-none font-medium"
              />
              {searchQuery ? (
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={handleClearMobileSearch}
                    aria-label="Clear search"
                    title="Clear search"
                    className="p-1 text-[#7a6274] hover:text-[#34222e] hover:bg-[#fee9d7] rounded-full cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePerformSearch()}
                    className="px-2 py-0.5 rounded-lg bg-[#0c831f] text-white text-[11px] font-bold cursor-pointer transition"
                  >
                    Search
                  </button>
                </div>
              ) : null}
            </div>

            {/* Mobile Autocomplete Search Suggestions Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div 
                className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-[#f9bf8f]/60 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3 py-1 text-[10.5px] font-bold text-[#7a6274] border-b border-[#f9bf8f]/30 flex items-center justify-between">
                  <span>Search Suggestions</span>
                  <span className="text-[#0c831f] font-semibold">10-15 Min Delivery</span>
                </div>
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onSelectProduct(p);
                      setShowSearchDropdown(false);
                    }}
                    className="px-3 py-1.5 hover:bg-[#fee9d7]/50 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-lg bg-[#fffbf7] border border-[#f9bf8f]/40 flex items-center justify-center p-0.5 shrink-0">
                        <img src={p.image} alt={p.name} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#34222e] truncate">{p.name}</p>
                        <p className="text-[9.5px] text-[#7a6274]">SKU: {p.sku}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#34222e] bg-[#fee9d7] px-2 py-0.5 rounded-md shrink-0">
                      ₹{p.price}
                    </span>
                  </div>
                ))}
                <div
                  onClick={() => handlePerformSearch()}
                  className="px-3 py-1.5 border-t border-[#f9bf8f]/30 text-xs font-bold text-[#0c831f] hover:bg-[#fee9d7]/40 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="truncate">Search entire catalog for &ldquo;{searchQuery}&rdquo;</span>
                  <span className="text-[#7a6274] font-mono text-[10px]">↵</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Location Picker Modal */}
      {showLocationModal && createPortal(
        <div className="fixed inset-0 z-50 bg-[#34222e]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#fffbf7] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#f9bf8f]/60 relative text-[#34222e]">
            <button
              onClick={() => setShowLocationModal(false)}
              className="absolute top-4 right-4 p-2 text-[#7a6274] hover:text-[#34222e] rounded-full hover:bg-[#fee9d7] cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-[#34222e] mb-1">
              Select delivery location
            </h3>
            <p className="text-xs text-[#7a6274] mb-4">
              We show everything in stock at stores around you and pick the fastest one for each order.
            </p>

            <button
              onClick={() => {
                setLocateError(null);
                locateMe()
                  .then(() => setShowLocationModal(false))
                  .catch((err: Error) => setLocateError(err.message));
              }}
              className="mb-3 w-full rounded-2xl border border-[#0c831f] bg-[#f2fcf4] p-3 text-xs font-bold text-[#0c831f] cursor-pointer"
            >
              Use my current location
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitPlace();
              }}
              className="mb-3 flex items-center gap-2"
            >
              <input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="PIN code or area, e.g. 208001 or Swaroop Nagar"
                inputMode="text"
                className="flex-1 rounded-xl border border-[#f9bf8f]/70 bg-white px-3 py-2.5 text-xs text-[#34222e] outline-none focus:border-[#0c831f]"
              />
              <button
                type="submit"
                disabled={locateBusy || placeQuery.trim().length < 3}
                className="rounded-xl bg-[#34222e] px-3.5 py-2.5 text-xs font-bold text-[#fee9d7] disabled:opacity-50 cursor-pointer"
              >
                {locateBusy ? '…' : 'Find'}
              </button>
            </form>
            {locateError && <p className="mb-3 text-xs text-[#e2434b]">{locateError}</p>}

            {placeResults.length > 0 && (
              <div className="mb-3 space-y-1.5 rounded-2xl border border-[#f9bf8f]/40 p-2">
                {placeResults.map((r, i) => (
                  <button
                    key={`${r.latitude}-${r.longitude}-${i}`}
                    onClick={() => {
                      setLocation(r);
                      setPlaceResults([]);
                      setPlaceQuery('');
                      setShowLocationModal(false);
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs hover:bg-[#fee9d7]/50 cursor-pointer"
                  >
                    <span className="font-bold text-[#34222e]">{r.area}</span>
                    {r.pincode && <span className="ml-2 rounded bg-[#fee9d7] px-1.5 py-0.5 text-[10px]">{r.pincode}</span>}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {LOCATION_PRESETS.map((preset) => (
                <div
                  key={preset.label}
                  onClick={() => {
                    setLocation(preset);
                    setShowLocationModal(false);
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    location.label === preset.label
                      ? 'border-[#0c831f] bg-[#f2fcf4] ring-1 ring-[#0c831f]'
                      : 'border-[#f9bf8f]/40 hover:border-[#f9bf8f] hover:bg-[#fee9d7]/30'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-[#e2434b] mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#34222e]">{preset.label}</span>
                        <span className="text-[10px] bg-[#fee9d7] px-1.5 py-0.5 rounded text-[#34222e]">{preset.pincode}</span>
                      </div>
                      <p className="text-xs text-[#7a6274] mt-0.5">{preset.area}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
