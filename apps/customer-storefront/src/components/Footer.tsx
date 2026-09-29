'use client';
import React from 'react';
import { 
  ShieldCheck, 
  Truck, 
  RotateCcw,
  Zap,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { SpacebornLogo } from './SpacebornLogo';
import { AppView } from '../types';

interface FooterProps {
  onNavigate: (view: AppView) => void;
  onSelectCategory: (cat: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onSelectCategory }) => {
  return (
    <footer className="bg-[#fffbf7] text-[#34222e] border-t border-[#f9bf8f]/60 text-xs">
      
      {/* Value Assurance Strip */}
      <div className="border-b border-[#f9bf8f]/40 bg-[#fee9d7]/40">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#f9bf8f]/60 flex items-center justify-center text-[#e2434b] shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h4 className="font-bold text-[#34222e] text-sm">10-15 Min Delivery</h4>
              <p className="text-[#7a6274] text-xs mt-0.5 leading-relaxed">
                Superfast local delivery for urgent components and prototype testing.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#f9bf8f]/60 flex items-center justify-center text-[#0c831f] shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-[#34222e] text-sm">Genuine Components</h4>
              <p className="text-[#7a6274] text-xs mt-0.5 leading-relaxed">
                Direct procurement from verified manufacturers and tested parts.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#f9bf8f]/60 flex items-center justify-center text-[#e2434b] shrink-0 shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-[#34222e] text-sm">Free Delivery Available</h4>
              <p className="text-[#7a6274] text-xs mt-0.5 leading-relaxed">
                Enjoy zero delivery fees on orders above ₹500 across active cities.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#f9bf8f]/60 flex items-center justify-center text-[#0c831f] shrink-0 shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-[#34222e] text-sm">Easy Returns & Replacements</h4>
              <p className="text-[#7a6274] text-xs mt-0.5 leading-relaxed">
                Prompt resolution and replacements if any component arrives defective.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        
        {/* Brand column */}
        <div className="space-y-3">
          <div 
            onClick={() => onNavigate('home')} 
            className="cursor-pointer inline-flex items-center gap-2"
          >
            <SpacebornLogo size="md" subtitle={false} />
          </div>

          <p className="text-[#7a6274] text-xs leading-relaxed max-w-sm">
            Quick commerce platform for electronics, microcontrollers, robotics, and maker hardware delivered in minutes.
          </p>

          <div className="space-y-1.5 text-xs text-[#7a6274] pt-2">
            <p className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-[#e2434b] shrink-0" />
              <span>Kanpur • Bengaluru • Noida • Pune • Chennai • Delhi</span>
            </p>
            <p className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-[#7a6274] shrink-0" />
              <span>support@spaceborn.in</span>
            </p>
            <p className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-[#7a6274] shrink-0" />
              <span>+91 080 4912 8800</span>
            </p>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-2.5">
          <h5 className="font-bold text-[#34222e] text-xs uppercase tracking-wider">Categories</h5>
          <ul className="space-y-1.5 text-xs text-[#7a6274]">
            <li>
              <button onClick={() => { onSelectCategory('Development Boards'); onNavigate('catalog'); }} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Development Boards
              </button>
            </li>
            <li>
              <button onClick={() => { onSelectCategory('Motors & Drivers'); onNavigate('catalog'); }} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Motors & Drivers
              </button>
            </li>
            <li>
              <button onClick={() => { onSelectCategory('Sensors & Modules'); onNavigate('catalog'); }} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Sensors & Modules
              </button>
            </li>
            <li>
              <button onClick={() => { onSelectCategory('Batteries & Chargers'); onNavigate('catalog'); }} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Batteries & Power
              </button>
            </li>
            <li>
              <button onClick={() => { onSelectCategory('Tools & Soldering'); onNavigate('catalog'); }} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Tools & Soldering
              </button>
            </li>
          </ul>
        </div>

        {/* Quick Links */}
        <div className="space-y-2.5">
          <h5 className="font-bold text-[#34222e] text-xs uppercase tracking-wider">Quick Links</h5>
          <ul className="space-y-1.5 text-xs text-[#7a6274]">
            <li>
              <button onClick={() => onNavigate('orders')} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                My Orders
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('wishlist')} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Wishlist
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('catalog')} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                All Products
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('b2b')} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Bulk Orders (B2B)
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('vendor')} className="hover:text-[#0c831f] text-[#0c831f] font-semibold transition cursor-pointer text-left flex items-center gap-1">
                <span>Become a Seller / Supplier Hub</span>
              </button>
            </li>
          </ul>
        </div>

        {/* Customer Care */}
        <div className="space-y-2.5">
          <h5 className="font-bold text-[#34222e] text-xs uppercase tracking-wider">Help & Legal</h5>
          <ul className="space-y-1.5 text-xs text-[#7a6274]">
            <li>
              <button onClick={() => onNavigate('about')} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                About Us
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('contact')} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Contact & Support
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('warranty')} className="hover:text-[#e2434b] transition cursor-pointer text-left">
                Warranty & Returns
              </button>
            </li>
          </ul>

          <div className="pt-3">
            <span className="text-[10px] text-[#7a6274] block mb-1 font-semibold uppercase tracking-wider">
              Payments Accepted
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-white border border-[#f9bf8f]/60 px-2 py-0.5 rounded text-[#34222e] font-semibold text-[11px]">
                UPI
              </span>
              <span className="bg-white border border-[#f9bf8f]/60 px-2 py-0.5 rounded text-[#34222e] font-semibold text-[11px]">
                Cards
              </span>
              <span className="bg-white border border-[#f9bf8f]/60 px-2 py-0.5 rounded text-[#34222e] font-semibold text-[11px]">
                Net Banking
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Copyright Sub-bar */}
      <div className="border-t border-[#f9bf8f]/40 bg-[#fee9d7]/50 py-4 px-4 text-center text-[#7a6274] text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Spaceborn Technologies. Electronics Quick Commerce.</p>
          <div className="flex items-center space-x-4">
            <button onClick={() => onNavigate('about')} className="hover:text-[#e2434b] cursor-pointer">About</button>
            <span>•</span>
            <button onClick={() => onNavigate('warranty')} className="hover:text-[#e2434b] cursor-pointer">Privacy & Terms</button>
            <span>•</span>
            <button onClick={() => onNavigate('contact')} className="hover:text-[#e2434b] cursor-pointer">Help Center</button>
          </div>
        </div>
      </div>

    </footer>
  );
};
