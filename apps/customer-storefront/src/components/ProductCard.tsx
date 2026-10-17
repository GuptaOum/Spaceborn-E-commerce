'use client';

import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Zap, Plus, Minus, Star, Eye } from 'lucide-react';

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
  const [imgSrc, setImgSrc] = useState(product.image || '/spaceborn-logo.svg');
  const [isPopping, setIsPopping] = useState(false);

  const triggerPop = () => {
    setIsPopping(true);
    setTimeout(() => setIsPopping(false), 300);
  };

  useEffect(() => {
    setImgSrc(product.image || '/spaceborn-logo.svg');
  }, [product.image]);

  useEffect(() => {
    setQuantity(cartQuantity);
    setIsAdded(cartQuantity > 0);
  }, [cartQuantity]);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerPop();
    setIsAdded(true);
    setQuantity(1);
    onAddToCart(product, 1);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < product.stock) {
      triggerPop();
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
  const isOurPick = Boolean(product.isChoice) || Boolean(product.badges?.includes('our_pick'));
  const discountPercent =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  const ratingScore = product.rating || 0;
  const reviewsCount = product.reviewsCount || 0;

  return (
    <article
      onClick={() => onSelect(product)}
      className="bg-sb-card border border-sb-line/60 hover:border-sb-brand hover:shadow-md rounded-2xl p-2.5 sm:p-3 transition-all duration-200 flex flex-col justify-between group overflow-hidden cursor-pointer relative shadow-2xs"
    >
      {/* Top Header: Delivery ETA & Badges */}
      <div className="flex items-center justify-between gap-1 mb-1.5 relative z-10 min-h-[22px]">
        {/* Delivery ETA Pill */}
        <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-bold text-sb-brand bg-sb-brand-soft border border-sb-brand/20 px-1.5 py-0.5 rounded-md shrink-0">
          <Zap className="w-2.5 h-2.5 fill-sb-brand" />
          <span>{deliveryTime} MINS</span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {/* Discount Pill */}
          {discountPercent && discountPercent > 0 ? (
            <span className="bg-[#e2434b] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
              {discountPercent}% OFF
            </span>
          ) : null}

          {/* Quick View Button (Desktop Hover) */}
          <button
            onClick={handleQuickViewClick}
            className="w-5 h-5 rounded-full bg-white text-sb-ink/60 hover:text-sb-brand hover:bg-white hidden md:flex items-center justify-center transition opacity-0 group-hover:opacity-100 cursor-pointer shadow-2xs border border-sb-line/40"
            title="Quick View"
          >
            <Eye className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Product Image Canvas */}
      <div className="w-full h-32 sm:h-36 rounded-xl bg-white border border-sb-line/30 flex items-center justify-center p-2 mb-2 overflow-hidden relative">
        <img
          src={imgSrc}
          alt={product.name}
          className="max-h-full max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105 will-change-transform"
          loading="lazy"
          onError={() => setImgSrc('/spaceborn-logo.svg')}
        />

        {/* Our Pick Badge: Only on verified selected products */}
        {isOurPick && (
          <span className="absolute bottom-1.5 left-1.5 z-10 inline-flex items-center gap-0.5 rounded-md bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800 shadow-2xs">
            ★ Our Pick
          </span>
        )}
      </div>

      {/* Product Body Details */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {product.stock > 0 && product.stock <= 5 && (
            <div className="mb-0.5 text-right text-[9.5px] font-bold text-[#e2434b]">Only {product.stock} left</div>
          )}

          {/* Product Title (2-line clamped) */}
          <h3 className="text-xs sm:text-[13px] font-bold text-sb-ink line-clamp-2 leading-snug group-hover:text-sb-brand transition-colors mb-1 min-h-[32px]">
            {product.name}
          </h3>

          {reviewsCount > 0 ? (
            <div className="flex items-center gap-1 text-[10px] text-sb-muted mb-2">
              <div className="flex items-center text-amber-400">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </div>
              <span className="font-bold text-sb-ink">{ratingScore}</span>
              <span className="text-sb-muted">({reviewsCount})</span>
            </div>
          ) : (
            <p className="mb-2 text-[10px] text-sb-muted">No reviews yet</p>
          )}
        </div>

        {/* Pricing & Add to Cart Action */}
        <div className="pt-2 border-t border-sb-line/30 flex items-center justify-between gap-1.5 mt-auto">
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-sb-ink leading-tight">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-[9.5px] text-sb-muted line-through font-medium leading-tight">
                  ₹{product.originalPrice}
                </span>
              )}
            </div>
            <span className="text-[8.5px] text-sb-muted font-medium leading-none mt-0.5">
              (Incl. GST)
            </span>
          </div>

          {/* Stepper / Add Button */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 w-[64px] sm:w-[72px] h-7 sm:h-8">
            {product.stock > 0 ? (
              !isAdded || quantity === 0 ? (
                <button
                  type="button"
                  onClick={handleAdd}
                  className={`w-full h-full rounded-lg border border-sb-brand text-sb-brand bg-sb-brand-soft hover:bg-sb-brand hover:text-white font-bold text-[10px] sm:text-[11px] transition-all flex items-center justify-center gap-0.5 shadow-2xs cursor-pointer active:scale-95 ${
                    isPopping ? 'scale-95' : ''
                  }`}
                >
                  <span>ADD</span>
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                </button>
              ) : (
                <div
                  className={`w-full h-full rounded-lg bg-sb-brand text-white flex items-center justify-between px-1.5 font-bold text-xs shadow-2xs animate-in zoom-in-95 duration-150 ${
                    isPopping ? 'scale-95' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={handleDecrement}
                    className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center hover:bg-black/20 rounded transition-colors active:scale-90 cursor-pointer"
                    title="Decrease"
                  >
                    <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                  </button>
                  <span className="text-[11px] sm:text-[12px] font-black tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantity >= product.stock}
                    className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center hover:bg-black/20 rounded transition-colors active:scale-90 cursor-pointer disabled:opacity-30"
                    title="Increase"
                  >
                    <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                  </button>
                </div>
              )
            ) : (
              <span className="w-full h-full px-1 rounded-lg font-bold text-[8.5px] bg-sb-canvas/50 text-sb-muted border border-sb-line/50 uppercase flex items-center justify-center">
                Out of Stock
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
