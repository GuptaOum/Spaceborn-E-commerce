'use client';
import React from 'react';
import { CartItem } from '../types';
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Zap, Plus, Minus, Lock } from 'lucide-react';

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
  if (!isOpen) return null;

  const totalAmount = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxableSubtotal = totalAmount / 1.18;
  const gstAmount = totalAmount - taxableSubtotal;

  const FREE_SHIPPING_THRESHOLD = 500;
  const amountNeededForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - totalAmount);
  const progressPercent = Math.min(100, Math.round((totalAmount / FREE_SHIPPING_THRESHOLD) * 100));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#34222e]/40 backdrop-blur-xs transition-opacity"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#fffbf7] shadow-2xl flex flex-col border-l border-[#f9bf8f]/60 text-[#34222e]">
          
          {/* Drawer Header */}
          <div className="px-5 py-4 bg-[#fee9d7] flex items-center justify-between border-b border-[#f9bf8f]/60">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#ffffff] border border-[#f9bf8f] flex items-center justify-center text-[#e2434b] shadow-xs">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-[#34222e]">
                  My Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                </h2>
                <p className="text-[11px] text-[#0c831f] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0c831f] animate-pulse"></span>
                  Delivery in 10-15 minutes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#7a6274] hover:text-[#34222e] hover:bg-[#fffbf7] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Meter */}
          <div className="p-3.5 bg-[#f2fcf4] border-b border-[#0c831f]/20">
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="text-[#34222e] flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-[#0c831f] fill-[#0c831f]" />
                {amountNeededForFreeShipping === 0 ? (
                  <span className="text-[#0c831f] font-bold">🎉 You've unlocked FREE 10-Min Delivery!</span>
                ) : (
                  <span>Add <strong className="text-[#0c831f] font-bold">₹{amountNeededForFreeShipping.toFixed(0)}</strong> more for FREE Delivery</span>
                )}
              </span>
              <span className="text-[11px] font-bold text-[#0c831f]">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#e0f5e5] rounded-full h-2 overflow-hidden border border-[#0c831f]/20">
              <div 
                className="bg-[#0c831f] h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-[#f9bf8f]/40">
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
                  className="mt-2 inline-flex items-center px-4 py-2 bg-[#0c831f] hover:bg-[#0a6e1a] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-[#0c831f]/20"
                >
                  Browse Hardware Catalog
                </button>
              </div>
            ) : (
              cart.map((item) => {
                const itemTotal = item.unitPrice * item.quantity;
                return (
                  <div key={item.product.id} className="pt-3 flex gap-3 items-start">
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
                      <h4 className="text-xs font-semibold text-[#34222e] line-clamp-2 leading-tight">
                        {item.product.name}
                      </h4>
                      <p className="text-[10px] text-[#7a6274] mt-0.5">
                        SKU: {item.product.sku}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        {/* Blinkit Green Stepper */}
                        <div className="flex items-center border border-[#0c831f] rounded-lg bg-[#0c831f] text-white overflow-hidden shadow-xs">
                          <button
                            onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-black/15 transition cursor-pointer"
                          >
                            <Minus className="w-3 h-3 stroke-[2.5]" />
                          </button>
                          <span className="w-7 text-center text-xs font-bold">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="w-7 h-7 flex items-center justify-center hover:bg-black/15 transition cursor-pointer disabled:opacity-40"
                          >
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <span className="text-xs font-bold text-[#34222e]">
                            ₹{itemTotal.toLocaleString('en-IN')}
                          </span>
                          <p className="text-[10px] text-[#7a6274]">₹{item.unitPrice} each</p>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => onRemoveItem(item.product.id)}
                          className="p-1 text-[#7a6274] hover:text-[#e2434b] transition cursor-pointer"
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

          {/* Drawer Footer Summary */}
          {cart.length > 0 && (
            <div className="p-4 bg-[#fee9d7] border-t border-[#f9bf8f]/60 space-y-3">
              <div className="space-y-1.5 text-xs text-[#7a6274]">
                <div className="flex justify-between">
                  <span>Taxable Subtotal (excl. GST):</span>
                  <span className="font-semibold text-[#34222e]">₹{taxableSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IGST / CGST+SGST (18%):</span>
                  <span className="font-semibold text-[#34222e]">₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Express Runner Dispatch:</span>
                  <span className="font-semibold text-[#0c831f]">
                    {amountNeededForFreeShipping === 0 ? 'FREE' : '₹49.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#34222e] pt-2 border-t border-[#f9bf8f]/60">
                  <span>Grand Total:</span>
                  <span className="text-[#34222e] text-base font-extrabold">
                    ₹{(totalAmount + (amountNeededForFreeShipping === 0 ? 0 : 49)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    onClose();
                    onProceedToCheckout();
                  }}
                  className="w-full bg-[#0c831f] hover:bg-[#0a6e1a] text-white py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-between transition-all shadow-md shadow-[#0c831f]/25 cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>Proceed to Pay</span>
                  </div>
                  <span className="text-white/90 font-medium">
                    ₹{(totalAmount + (amountNeededForFreeShipping === 0 ? 0 : 49)).toLocaleString('en-IN')} â†’
                  </span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onProceedToCart();
                  }}
                  className="w-full bg-white hover:bg-[#fffbf7] text-[#34222e] border border-[#f9bf8f] py-2 px-4 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  <span>Review Cart & GST Invoice Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-center space-x-3 text-[10px] text-[#7a6274] pt-1">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0c831f]" />
                  <span>256-Bit SSL Encrypted</span>
                </span>
                <span>•</span>
                <span>GST Compliant Invoicing</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
