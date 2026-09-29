'use client';
import React, { useState } from 'react';
import { Product } from '../types';
import { X, Star, ShoppingCart, Check, ShieldCheck, ArrowRight, Zap, ZoomIn } from 'lucide-react';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (p: Product, qty: number) => void;
  onViewFullDetails: (p: Product) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onViewFullDetails,
}) => {
  if (!product) return null;

  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(product.image);
  const [added, setAdded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  const images = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];

  const handleAdd = () => {
    onAddToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#34222e]/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative bg-[#fffbf7] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#f9bf8f]/60 text-[#34222e]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white hover:bg-[#fee9d7] text-[#7a6274] hover:text-[#34222e] flex items-center justify-center transition cursor-pointer border border-[#f9bf8f]/60 shadow-xs"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Gallery Column */}
          <div className="space-y-4">
            <div 
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={handleMouseMove}
              className="bg-white border border-[#f9bf8f]/60 rounded-2xl p-4 flex items-center justify-center h-64 overflow-hidden shadow-xs relative cursor-crosshair select-none group"
            >
              <span className={`absolute top-3 left-3 px-2 py-0.5 rounded-full bg-[#f2fcf4] text-[#0c831f] text-[10px] font-bold border border-[#0c831f]/20 flex items-center gap-1 transition-opacity ${isZoomed ? 'opacity-0' : 'opacity-100'}`}>
                <Zap className="w-3 h-3 fill-[#0c831f]" />
                <span>{product.deliveryMins || 10} MINS</span>
              </span>
              <img
                src={activeImage}
                alt={product.name}
                style={{
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                  transform: isZoomed ? 'scale(2.2)' : 'scale(1)',
                  transition: isZoomed ? 'transform 0.08s ease-out' : 'transform 0.3s ease-out',
                }}
                className="max-h-52 max-w-full object-contain pointer-events-none will-change-transform"
              />

              {/* Hover to Zoom Guide Badge */}
              <div className={`absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur-xs text-[#7a6274] border border-[#f9bf8f]/60 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs transition-opacity duration-200 pointer-events-none ${isZoomed ? 'opacity-0' : 'opacity-80 group-hover:opacity-100'}`}>
                <ZoomIn className="w-3 h-3 text-[#0c831f]" />
                <span>Hover to zoom</span>
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(img)}
                    className={`w-14 h-14 rounded-xl border p-1 bg-white shrink-0 overflow-hidden cursor-pointer transition-all ${
                      activeImage === img ? 'border-[#0c831f] ring-2 ring-[#0c831f]/20' : 'border-[#f9bf8f]/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`thumb-${i}`} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-[#7a6274] pt-2 border-t border-[#f9bf8f]/40">
              <span className="flex items-center space-x-1 font-medium text-[#0c831f]">
                <ShieldCheck className="w-4 h-4 text-[#0c831f]" />
                <span>100% Genuine Part</span>
              </span>
              <span>SKU: {product.sku}</span>
            </div>
          </div>

          {/* Details Column */}
          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#7a6274] mb-1">
                <span className="text-[#e2434b] font-bold uppercase tracking-wider">{product.category}</span>
                <span>•</span>
                <span>{product.brand}</span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-[#34222e] leading-snug mb-2">
                {product.name}
              </h2>

              <div className="flex items-center space-x-2 mb-3">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-[#34222e]">{product.rating}</span>
                <span className="text-xs text-[#7a6274]">({product.reviewsCount} reviews)</span>
              </div>

              {/* Price */}
              <div className="bg-[#fee9d7]/50 p-3.5 rounded-2xl border border-[#f9bf8f]/60 mb-4">
                <div className="flex items-baseline space-x-3">
                  <span className="text-2xl font-bold text-[#34222e]">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  {product.originalPrice && (
                    <span className="text-sm text-[#7a6274] line-through">
                      ₹{product.originalPrice}
                    </span>
                  )}
                  <span className="text-xs font-bold text-[#0c831f] bg-[#f2fcf4] px-2 py-0.5 rounded-lg border border-[#0c831f]/20">
                    Incl. 18% GST
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#7a6274] line-clamp-3 mb-4 leading-relaxed">
                {product.description}
              </p>

              {/* Highlights */}
              <ul className="text-xs text-[#7a6274] space-y-1.5 mb-5 font-medium">
                {product.features.slice(0, 3).map((f, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0c831f] mt-1.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-[#f9bf8f]/40">
              <div className="flex items-center space-x-3">
                <div className="flex items-center border border-[#f9bf8f] rounded-xl overflow-hidden bg-white shadow-xs">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-10 flex items-center justify-center text-[#34222e] hover:bg-[#fee9d7] font-bold cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <span className="w-10 h-10 flex items-center justify-center font-bold text-sm bg-white border-x border-[#f9bf8f] text-[#34222e]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-8 h-10 flex items-center justify-center text-[#34222e] hover:bg-[#fee9d7] font-bold cursor-pointer transition-colors"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAdd}
                  disabled={product.stock <= 0}
                  className={`flex-1 h-10 rounded-xl flex items-center justify-center space-x-2 font-bold text-sm transition-all cursor-pointer shadow-xs ${
                    added 
                      ? 'bg-[#0c831f] text-white' 
                      : 'bg-[#0c831f] hover:bg-[#0a6e1a] text-white active:scale-[0.98]'
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added to Cart</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onViewFullDetails(product);
                }}
                className="w-full text-center text-xs font-semibold text-[#e2434b] hover:text-[#c7323a] py-1 flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>View Full Product Specifications</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
