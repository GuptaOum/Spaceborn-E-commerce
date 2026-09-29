'use client';
import React from 'react';
import { CartItem } from '../types';
import { ShoppingBag, Zap, ArrowRight } from 'lucide-react';

interface StickyCartDockProps {
  cart: CartItem[];
  onOpenCart: () => void;
  currentView: string;
}

export const StickyCartDock: React.FC<StickyCartDockProps> = ({
  cart,
  onOpenCart,
  currentView,
}) => {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Free delivery threshold: ₹500
  const freeDeliveryThreshold = 500;
  const remainingForFree = Math.max(0, freeDeliveryThreshold - subtotal);

  if (totalItems === 0 || currentView === 'cart' || currentView === 'checkout' || currentView.startsWith('product') || currentView.startsWith('orders')) {
    return null;
  }

  return (
    <aside className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-8 z-40 w-[94%] max-w-xl md:w-auto animate-in slide-in-from-bottom-6 duration-300">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 rounded-2xl bg-[#0c831f] text-white shadow-2xl shadow-[#0c831f]/30 border border-[#0a701a]">
        
        {/* Cart Icon & Live Dispatch Counter */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#f8cb46] text-[#34222e] font-mono text-[9.5px] font-black flex items-center justify-center shadow-xs">
              {totalItems}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-black">
              <span>{totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
              <span>•</span>
              <span className="text-[#f8cb46] font-mono font-black text-sm">
                ₹{subtotal.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-[10.5px] text-white/90 font-medium flex items-center gap-1">
              <span>⚡ 10-15 Min Delivery</span>
              <span className="text-white/60">•</span>
              <span>{remainingForFree === 0 ? 'Free Express Delivery' : `Add ₹${remainingForFree} for Free`}</span>
            </p>
          </div>
        </div>

        {/* Action Checkout Trigger */}
        <button
          onClick={onOpenCart}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-[#0c831f] font-black text-xs uppercase tracking-wider hover:bg-slate-100 shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>View Cart</span>
          <ArrowRight className="w-4 h-4 stroke-[3]" />
        </button>

      </div>
    </aside>
  );
};
