'use client';
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Eye, Zap, Plus, Minus, Star } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number) => void;
  onQuickView?: (product: Product) => void;
  cartQuantity?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onAddToCart,
  onQuickView,
  cartQuantity = 0,
}) => {
  const [quantity, setQuantity] = useState(cartQuantity);
  const [isAdded, setIsAdded] = useState(cartQuantity > 0);

  useEffect(() => {
    setQuantity(cartQuantity);
    setIsAdded(cartQuantity > 0);
  }, [cartQuantity]);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAdded(true);
    setQuantity(1);
    onAddToCart(product, 1);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < product.stock) {
      const next = quantity + 1;
      setQuantity(next);
      onAddToCart(product, next);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > 1) {
      const next = quantity - 1;
      setQuantity(next);
      onAddToCart(product, next);
    } else {
      setIsAdded(false);
      setQuantity(0);
      onAddToCart(product, 0);
    }
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    } else {
      onSelect(product);
    }
  };

  const deliveryTime = product.deliveryMins || 10;
  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  // Short spec string for quick commerce scanning (e.g. "12V • 300 RPM • Hall Enc.")
  const specSummary = product.rpm 
    ? `${product.voltage || '12V'} • ${product.rpm} RPM`
    : product.shaftType
    ? `${product.shaftType} • 1 Unit`
    : product.packSize || '1 Unit • Standard Pack';

  return (
    <article 
      onClick={() => onSelect(product)}
      className="bg-[#fffbf7] border border-[#f9bf8f]/60 hover:border-[#0c831f] hover:shadow-md rounded-2xl p-2.5 sm:p-3 transition-all duration-200 flex flex-col justify-between group overflow-hidden cursor-pointer relative shadow-xs"
    >
      {/* Top Badges Row */}
      <div className="flex items-center justify-between mb-1.5 relative z-10">
        {/* Delivery ETA Badge */}
        <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-[#0c831f] uppercase tracking-wide">
          <Zap className="w-3 h-3 fill-[#0c831f]" />
          <span>{deliveryTime} MINS</span>
        </span>

        <div className="flex items-center gap-1">
          {/* Discount Ribbon */}
          {discountPercent && discountPercent > 0 && (
            <span className="bg-[#e2434b] text-white text-[9.5px] font-black px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider">
              {discountPercent}% OFF
            </span>
          )}

          {/* Quick View Button */}
          <button
            onClick={handleQuickViewClick}
            className="w-6 h-6 rounded-full bg-white/90 text-[#34222e]/60 hover:text-[#e2434b] hover:bg-white flex items-center justify-center transition opacity-0 group-hover:opacity-100 cursor-pointer shadow-xs border border-[#f9bf8f]/40"
            title="Quick View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Product Image on Clean Light Canvas */}
      <div className="w-full h-36 rounded-xl bg-white border border-[#f9bf8f]/30 flex items-center justify-center p-2 mb-2 overflow-hidden relative">
        <img 
          src={product.image} 
          alt={product.name}
          className="max-h-full max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-110 will-change-transform"
          loading="lazy"
        />
      </div>

      {/* Product Info */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Category / Brand Tag */}
          <div className="flex items-center justify-between text-[10px] text-[#34222e]/60 font-medium mb-0.5">
            <span className="truncate max-w-[120px] font-bold text-[#e2434b] uppercase tracking-wider">{product.brand}</span>
            <span className="flex items-center gap-0.5 font-bold text-[#34222e]/80">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
            </span>
          </div>

          {/* Title: 2-line clamped like Blinkit */}
          <h3 className="text-xs font-bold text-[#34222e] line-clamp-2 leading-snug group-hover:text-[#e2434b] transition-colors mb-1">
            {product.name}
          </h3>

          {/* Vendor Badge */}
          {product.vendorName && (
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-[9px] font-bold text-[#0c831f] bg-[#f2fcf4] border border-[#0c831f]/20 px-1.5 py-0.5 rounded shadow-xs truncate max-w-full">
                By {product.vendorName} • {product.city || 'Local'}
              </span>
            </div>
          )}

          {/* Clean Technical Spec Line */}
          <p className="text-[11px] font-medium text-[#34222e]/70 truncate mb-2">
            {specSummary}
          </p>
        </div>

        {/* Pricing & Iconic Blinkit ADD / Stepper Button */}
        <div className="pt-2 border-t border-[#f9bf8f]/30 flex items-center justify-between mt-auto">
          <div className="flex flex-col">
            <div className="flex items-baseline space-x-1">
              <span className="text-xs sm:text-sm font-black text-[#34222e]">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-[10px] text-[#34222e]/40 line-through font-medium">
                  ₹{product.originalPrice}
                </span>
              )}
            </div>
            <span className="text-[9px] text-[#34222e]/60 font-medium">
              (Incl. 18% GST)
            </span>
          </div>

          {/* Dynamic Stepper Button (Blinkit Style) */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 w-[72px] h-8">
            {product.stock > 0 ? (
              !isAdded || quantity === 0 ? (
                <button
                  type="button"
                  onClick={handleAdd}
                  className="w-[72px] h-8 rounded-lg border-2 border-[#0c831f] text-[#0c831f] bg-[#f2fcf4] hover:bg-[#0c831f] hover:text-white font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
                >
                  ADD
                </button>
              ) : (
                <div className="w-[72px] h-8 rounded-lg bg-[#0c831f] text-white flex items-center justify-between px-1.5 font-bold text-xs shadow-sm shadow-[#0c831f]/30 animate-in zoom-in-95 duration-150">
                  <button 
                    type="button"
                    onClick={handleDecrement}
                    className="w-5 h-5 flex items-center justify-center hover:bg-black/20 rounded transition-colors active:scale-90 cursor-pointer"
                    title="Decrease"
                  >
                    <Minus className="w-3 h-3 stroke-[3]" />
                  </button>
                  <span className="text-[12px] font-black tabular-nums">{quantity}</span>
                  <button 
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantity >= product.stock}
                    className="w-5 h-5 flex items-center justify-center hover:bg-black/20 rounded transition-colors active:scale-90 cursor-pointer disabled:opacity-30"
                    title="Increase"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                  </button>
                </div>
              )
            ) : (
              <span className="h-8 px-2 rounded-lg font-bold text-[9px] bg-[#fcedde] text-[#34222e]/40 border border-[#f9bf8f]/60 uppercase flex items-center justify-center">
                Out of Stock
              </span>
            )}
          </div>
        </div>

      </div>
    </article>
  );
};
