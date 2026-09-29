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
  ShieldCheck
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

const WAREHOUSE_HUBS = [
  { city: 'Kanpur', area: 'Kanpur Center, Mall Road', pincode: '208001', eta: '10 MINS', active: true },
  { city: 'Bengaluru', area: 'Koramangala 4th Block', pincode: '560034', eta: '12 MINS', active: false },
  { city: 'Delhi', area: 'Connaught Place / Okhla', pincode: '110020', eta: '10 MINS', active: false },
  { city: 'Noida', area: 'Sector 62 Tech Hub', pincode: '201301', eta: '12 MINS', active: false },
  { city: 'Pune', area: 'Hinjawadi Phase 1', pincode: '411057', eta: '15 MINS', active: false },
  { city: 'Chennai', area: 'OMR Tech Corridor, Taramani', pincode: '600113', eta: '12 MINS', active: false },
  { city: 'Hyderabad', area: 'HITEC City, Madhapur', pincode: '500081', eta: '15 MINS', active: false },
];

import { useStore } from '../context/StoreContext';

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
  products,
  onSelectProduct,
}) => {
  const { selectedCity, setSelectedCity } = useStore();
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const selectedHub = WAREHOUSE_HUBS.find(h => h.city === selectedCity) || WAREHOUSE_HUBS[0];
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const searchResults = searchQuery.trim().length > 1
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <header className="sticky top-0 z-50 bg-[#fffbf7] border-b border-[#f9bf8f]/60 shadow-xs transition-all">
      {/* Main Clean Blinkit-Style Header */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3 md:gap-6">
          
          {/* Brand Logo & Location Switcher */}
          <div className="flex items-center space-x-3 sm:space-x-5 shrink-0">
            {/* Spaceborn Brand Logo */}
            <div 
              onClick={() => onNavigate('home')} 
              className="cursor-pointer shrink-0 mr-1 sm:mr-2 hover:opacity-90 active:scale-98 transition-all"
              title="Spaceborn"
            >
              <SpacebornLogo size="md" subtitle={false} />
            </div>

            {/* Delivery Location Selector */}
            <div 
              onClick={() => setShowLocationModal(true)}
              className="hidden sm:flex flex-col text-left cursor-pointer group pl-2 sm:pl-3 border-l border-[#f9bf8f]/60"
            >
              <div className="flex items-center space-x-1 text-[#0c831f] font-bold text-xs">
                <span>Delivery in {selectedHub.eta}</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-[#34222e]/80 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#e2434b]" />
                <span className="truncate max-w-[170px]">{selectedHub.area}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#34222e]/60 group-hover:translate-y-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Minimalist Search Bar */}
          <div className="relative flex-1 max-w-xl hidden md:block">
            <div className="flex items-center rounded-xl bg-[#fee9d7]/50 border border-[#f9bf8f]/70 hover:bg-[#fffbf7] focus-within:bg-white focus-within:border-[#0c831f] focus-within:ring-2 focus-within:ring-[#0c831f]/10 transition-all overflow-hidden px-3.5 py-2">
              <Search className="w-4 h-4 text-[#7a6274] mr-2.5 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder={placeholders[placeholderIndex]}
                className="w-full bg-transparent text-xs sm:text-sm text-[#34222e] placeholder:text-[#7a6274]/70 outline-none font-medium"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {searchQuery ? (
                  <button 
                    onClick={() => onSearchChange('')} 
                    className="p-1 text-[#7a6274] hover:text-[#34222e] rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#f9bf8f]/60 text-[#7a6274] font-mono text-[10px]">
                    ⌘K
                  </kbd>
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
              </div>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            
            {/* Orders Action */}
            <button 
              onClick={() => onNavigate('orders')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#f9bf8f]/60 bg-[#fffbf7] hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-semibold transition-all cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-[#7a6274]" />
              <span>Orders</span>
            </button>

            {/* Account Profile Icon */}
            <div className="relative">
              {user ? (
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="flex items-center space-x-2 text-[#34222e] p-1 rounded-xl hover:bg-[#fee9d7]/50 transition cursor-pointer"
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
                  className="flex items-center space-x-1.5 text-[#34222e] hover:text-[#e2434b] px-3.5 py-2 rounded-xl text-xs font-bold transition hover:bg-[#fee9d7]/50 border border-[#f9bf8f]/60 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>Login</span>
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
                    <button onClick={() => { onNavigate('profile'); setShowAccountMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fee9d7]/50 flex items-center space-x-2.5 text-[#34222e] text-xs font-medium cursor-pointer">
                      <Settings className="w-3.5 h-3.5 text-[#7a6274]" /> <span>Account Profile</span>
                    </button>
                    <button onClick={() => { onNavigate('orders'); setShowAccountMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fee9d7]/50 flex items-center space-x-2.5 text-[#34222e] text-xs font-medium cursor-pointer">
                      <Receipt className="w-3.5 h-3.5 text-[#0c831f]" /> <span>My Orders</span>
                    </button>
                    <button onClick={() => { onNavigate('wishlist'); setShowAccountMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#fee9d7]/50 flex items-center space-x-2.5 text-[#34222e] text-xs font-medium cursor-pointer">
                      <Heart className="w-3.5 h-3.5 text-[#e2434b]" /> <span>Wishlist ({wishlistCount})</span>
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
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-[#0c831f] hover:bg-[#0a6e1a] text-white font-bold text-xs sm:text-sm shadow-sm transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{cartItemsCount > 0 ? `${cartItemsCount} items` : 'Cart'}</span>
              {cartItemsCount > 0 && (
                <>
                  <span className="text-white/60 text-xs">•</span>
                  <span className="font-bold text-xs text-white">
                    ₹{cartSubtotal.toLocaleString('en-IN')}
                  </span>
                </>
              )}
            </button>

          </div>

        </div>

        {/* Mobile Search Bar */}
        <div className="mt-2.5 block md:hidden">
          <div className="flex items-center rounded-xl bg-[#fee9d7]/50 border border-[#f9bf8f]/70 px-3 py-2">
            <Search className="w-4 h-4 text-[#7a6274] mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search components, sensors, motors..."
              className="w-full bg-transparent text-xs text-[#34222e] placeholder:text-[#7a6274]/70 outline-none font-medium"
            />
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
              Choose your location for 10-15 minute delivery.
            </p>

            <div className="space-y-2">
              {WAREHOUSE_HUBS.map((hub) => (
                <div
                  key={hub.pincode}
                  onClick={() => {
                    setSelectedCity(hub.city);
                    setShowLocationModal(false);
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedHub.pincode === hub.pincode
                      ? 'border-[#0c831f] bg-[#f2fcf4] ring-1 ring-[#0c831f]'
                      : 'border-[#f9bf8f]/40 hover:border-[#f9bf8f] hover:bg-[#fee9d7]/30'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-[#e2434b] mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#34222e]">{hub.city}</span>
                        <span className="text-[10px] bg-[#fee9d7] px-1.5 py-0.5 rounded text-[#34222e]">{hub.pincode}</span>
                      </div>
                      <p className="text-xs text-[#7a6274] mt-0.5">{hub.area}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#0c831f] bg-white border border-[#0c831f]/20 px-2 py-0.5 rounded-md">
                      {hub.eta}
                    </span>
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
