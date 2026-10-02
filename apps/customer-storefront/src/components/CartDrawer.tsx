'use client';
import React, { useEffect } from 'react';
import { CartItem } from '../types';
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Zap, Plus, Minus, Lock } from 'lucide-react';
import { estimateTotals, FREE_DELIVERY_THRESHOLD } from '../lib/pricing';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onProceedToCart: () => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCart,
  onProceedToCheckout,
}) => {
  // Prevent background scrolling and suppress floating demo banner while cart bottom sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  // Support ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Native mobile touch gesture: swipe down to dismiss bottom sheet
  const [touchStartY, setTouchStartY] = React.useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    if (deltaY > 50) {
      onClose();
    }
    setTouchStartY(null);
  };

  if (!isOpen) return null;

  const totalAmount = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totals = estimateTotals(totalAmount);
  const amountNeededForFreeShipping = totals.amountToFreeDelivery;
  const progressPercent = Math.min(100, Math.round((totalAmount / FREE_DELIVERY_THRESHOLD) * 100));

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#34222e]/60 backdrop-blur-xs transition-opacity animate-backdrop-fade"
      />

      {/* Cart Container: Mobile Bottom Sheet (slides up, 100% width, rounded top) vs Desktop Side Panel (slides from right) */}
      <div className={`absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px] sm:max-w-md w-full ${
        cart.length === 0 ? 'h-auto max-h-[85dvh]' : 'h-[90dvh] max-h-[90dvh]'
      } sm:h-full sm:max-h-full flex flex-col bg-[#fffbf7] shadow-2xl rounded-t-[28px] sm:rounded-none border-t sm:border-t-0 sm:border-l border-[#f9bf8f]/60 text-[#34222e] z-10 animate-sheet-slide-up sm:animate-drawer-slide-right overflow-hidden`}>
        
        {/* Mobile Drag / Pull Handle & Gesture Area */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={onClose}
          className="w-full pt-3 pb-1.5 flex justify-center items-center sm:hidden shrink-0 cursor-grab active:cursor-grabbing"
          title="Swipe down or tap to dismiss cart"
          aria-label="Dismiss cart"
        >
          <div className="w-12 h-1.5 rounded-full bg-[#34222e]/25 hover:bg-[#34222e]/40 transition-colors" />
        </div>

        {/* Drawer Header */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="px-4 sm:px-5 py-3 sm:py-4 bg-[#fee9d7] flex items-center justify-between border-b border-[#f9bf8f]/60 shrink-0 select-none"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-[#f9bf8f] flex items-center justify-center text-[#e2434b] shadow-xs">
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-[#34222e]">
                  My Cart
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#34222e]/10 text-[#34222e] text-[10px] sm:text-[11px] font-bold">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-[10.5px] sm:text-[11px] text-[#059669] font-semibold flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse"></span>
                <span>Delivered from stock near you</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-white/80 hover:bg-white text-[#7a6274] hover:text-[#34222e] flex items-center justify-center transition cursor-pointer shadow-xs active:scale-90"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Free Shipping Progress Meter */}
        <div className="px-4 py-2.5 sm:p-3.5 bg-[#ecfdf5] border-b border-[#10b981]/20 shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[#34222e] flex items-center space-x-1.5">
              <Zap className="w-4 h-4 text-[#059669] fill-[#059669]" />
              {amountNeededForFreeShipping === 0 ? (
                <span className="text-[#059669] font-bold">Free delivery on this cart</span>
              ) : (
                <span>Add <strong className="text-[#059669] font-bold">₹{amountNeededForFreeShipping.toFixed(0)}</strong> more for free delivery</span>
              )}
            </span>
            <span className="text-[11px] font-bold text-[#059669]">{progressPercent}%</span>
          </div>
          <div className="w-full bg-[#d1fae5] rounded-full h-1.5 sm:h-2 overflow-hidden border border-[#10b981]/20">
            <div 
              className="bg-[#10b981] h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-4 space-y-3 divide-y divide-[#f9bf8f]/40">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#fee9d7] border border-[#f9bf8f] mx-auto flex items-center justify-center text-[#e2434b]">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-[#34222e]">Your cart is empty</h3>
              <p className="text-xs text-[#7a6274] max-w-xs mx-auto">
                Explore high-precision motors, sensors, microcontrollers, and robotics hardware delivered in 10-15 mins.
              </p>
              <button
                onClick={onClose}
                className="mt-2 inline-flex items-center px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-[#059669]/20"
              >
                Browse Hardware Catalog
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const itemTotal = item.unitPrice * item.quantity;
              return (
                <div key={item.product.id} className="pt-3 first:pt-0 flex gap-3 items-start">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-white border border-[#f9bf8f]/60 p-1 shrink-0 flex items-center justify-center overflow-hidden shadow-xs">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-[#34222e] line-clamp-2 leading-tight">
                      {item.product.name}
                    </h4>
                    <p className="text-[10px] text-[#7a6274] mt-0.5">
                      SKU: {item.product.sku}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      {/* Blinkit Green Stepper with Mobile-Friendly Touch Targets */}
                      <div className="flex items-center border border-[#0c831f] rounded-lg bg-[#0c831f] text-white overflow-hidden shadow-xs">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center hover:bg-black/15 active:bg-black/25 transition cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3 stroke-[2.5]" />
                        </button>
                        <span className="w-8 sm:w-7 text-center text-xs font-bold">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          aria-label="Increase quantity"
                          className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center hover:bg-black/15 active:bg-black/25 transition cursor-pointer disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3 stroke-[2.5]" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <span className="text-xs sm:text-sm font-bold text-[#34222e]">
                          ₹{itemTotal.toLocaleString('en-IN')}
                        </span>
                        <p className="text-[10px] text-[#7a6274]">₹{item.unitPrice} each</p>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        aria-label="Remove item"
                        className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-[#7a6274] hover:text-[#e2434b] hover:bg-rose-50 active:scale-95 transition cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer Summary (Thumb Zone) */}
        {cart.length > 0 && (
          <div className="p-3.5 sm:p-4 bg-[#fee9d7] border-t border-[#f9bf8f]/60 shrink-0 space-y-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="space-y-1.5 text-xs text-[#7a6274]">
              <div className="flex justify-between">
                <span>Items (incl. GST):</span>
                <span className="font-semibold text-[#34222e]">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span className="font-semibold text-[#059669]">
                  {totals.freeDelivery ? 'FREE' : `from ₹${totals.deliveryFrom}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee:</span>
                <span className="font-semibold text-[#34222e]">₹{totals.platformFee}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base font-bold text-[#34222e] pt-1.5 border-t border-[#f9bf8f]/60">
                <span>Estimated total:</span>
                <span className="text-[#34222e] text-base sm:text-lg font-extrabold">
                  ₹{totals.estimatedTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[10px] text-[#7a6274]">
                Estimate. The exact amount, including delivery for each dispatch, is shown at checkout before you pay.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  onClose();
                  onProceedToCheckout();
                }}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white py-3.5 sm:py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-between transition-all shadow-md shadow-[#059669]/20 cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Proceed to Pay</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/95 font-semibold">
                  <span>₹{totals.estimatedTotal.toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </div>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onProceedToCart();
                }}
                className="w-full bg-white hover:bg-[#fffbf7] text-[#34222e] border border-[#f9bf8f] py-2.5 sm:py-2 px-4 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer active:scale-[0.99]"
              >
                <span>Review Cart & GST Invoice Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-center space-x-3 text-[10px] text-[#7a6274] pt-0.5">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                <span>256-Bit SSL Encrypted</span>
              </span>
              <span>•</span>
              <span>GST Compliant Invoicing</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
