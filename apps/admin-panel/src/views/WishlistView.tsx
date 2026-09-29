'use client';
import React from 'react';
import { 
  Heart, 
  ShoppingCart, 
  Trash2, 
  ArrowRight, 
  Package, 
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Product, AppView } from '../types';

interface WishlistViewProps {
  wishlist: Product[];
  onRemoveFromWishlist: (productId: string) => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onNavigate: (view: AppView) => void;
  onSelectProduct: (product: Product) => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  wishlist,
  onRemoveFromWishlist,
  onAddToCart,
  onNavigate,
  onSelectProduct,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
              <Heart className="w-6 h-6 fill-rose-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Saved Prototyping Wishlist</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                {wishlist.length} {wishlist.length === 1 ? 'component' : 'components'} saved for future hardware builds
              </p>
            </div>
          </div>

          {wishlist.length > 0 && (
            <button
              onClick={() => {
                wishlist.forEach(p => onAddToCart(p, 1));
                onNavigate('cart');
              }}
              className="bg-[#6366f1] hover:bg-[#d44000] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm shadow-orange-500/20 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Add All to Cart</span>
            </button>
          )}
        </div>

        {/* Wishlist Items List or Empty State */}
        {wishlist.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Your Wishlist is Empty</h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Explore our catalog of 15,000+ precision motors, LiDAR sensors, microcontrollers, and batteries, and click the heart icon on any component to save it here.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onNavigate('catalog')}
                className="bg-[#6366f1] hover:bg-[#d44000] text-white px-6 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Browse Spaceborn Catalog
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlist.map(product => (
              <div 
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-mono font-semibold">{product.sku}</span>
                    <button 
                      onClick={() => onRemoveFromWishlist(product.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div 
                    onClick={() => {
                      onSelectProduct(product);
                      onNavigate('product');
                    }}
                    className="flex items-center space-x-3 cursor-pointer group"
                  >
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-16 h-16 object-contain rounded-xl border border-slate-100 bg-slate-50 p-1.5 shrink-0 group-hover:scale-105 transition"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 group-hover:text-[#6366f1] transition">
                        {product.name}
                      </h4>
                      <span className="text-[11px] text-slate-500">{product.brand}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <span className="text-lg font-black text-slate-900 font-mono">₹{product.price}</span>
                      {product.originalPrice && (
                        <span className="text-xs text-slate-400 line-through ml-2 font-mono">₹{product.originalPrice}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      In Stock ({product.stock})
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center space-x-2">
                  <button
                    onClick={() => {
                      onAddToCart(product, 1);
                    }}
                    className="flex-1 bg-[#6366f1] hover:bg-[#d44000] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </button>
                  <button
                    onClick={() => {
                      onSelectProduct(product);
                      onNavigate('product');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Details
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
