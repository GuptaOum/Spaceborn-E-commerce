'use client';
import React from 'react';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { Product, AppView } from '../types';

interface WishlistViewProps {
  wishlist: Product[];
  /** Catalog for the current delivery location; saved items are a snapshot from when they were saved. */
  liveProducts: Product[];
  onRemoveFromWishlist: (productId: string) => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onNavigate: (view: AppView) => void;
  onSelectProduct: (product: Product) => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  wishlist,
  liveProducts,
  onRemoveFromWishlist,
  onAddToCart,
  onNavigate,
  onSelectProduct,
}) => {
  const live = new Map(liveProducts.map((p) => [p.id, p]));
  const items = wishlist.map((saved) => ({ saved, current: live.get(saved.id) }));
  const addable = items.filter(({ current }) => !current || current.stock > 0);

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-[#f9bf8f]/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-[#fee9d7] border border-[#f9bf8f]/60 text-[#e2434b] flex items-center justify-center shrink-0">
              <Heart className="w-6 h-6 fill-[#e2434b]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Saved parts</h1>
              <p className="text-[#7a6274] text-xs mt-0.5">
                {wishlist.length} {wishlist.length === 1 ? 'part' : 'parts'} saved
              </p>
            </div>
          </div>

          {addable.length > 0 && (
            <button
              onClick={() => {
                addable.forEach(({ saved, current }) => onAddToCart(current ?? saved, 1));
                onNavigate('cart');
              }}
              className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Add {addable.length === wishlist.length ? 'all' : addable.length} to cart</span>
            </button>
          )}
        </div>

        {wishlist.length === 0 ? (
          <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-10 sm:p-12 border border-[#f9bf8f]/60 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#fee9d7] border border-[#f9bf8f]/60 text-[#7a6274] flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold">Nothing saved yet</h3>
            <p className="text-[#7a6274] text-xs max-w-md mx-auto">
              Browse motors, sensors, microcontrollers and batteries in stock near you, and tap the heart on any part to save it here.
            </p>
            <button
              onClick={() => onNavigate('catalog')}
              className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-6 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Browse the catalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {items.map(({ saved, current }) => {
              const product = current ?? saved;
              const available = !current || current.stock > 0;
              return (
                <div
                  key={product.id}
                  className="bg-[#fffbf7] rounded-2xl border border-[#f9bf8f]/60 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#0c831f] transition"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#7a6274] mb-2">
                      <span className="font-mono font-semibold">{product.sku}</span>
                      <button
                        onClick={() => onRemoveFromWishlist(product.id)}
                        className="text-[#7a6274] hover:text-[#e2434b] p-1 cursor-pointer transition"
                        title="Remove from saved"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div onClick={() => onSelectProduct(product)} className="flex items-center space-x-3 cursor-pointer group">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-16 h-16 object-contain rounded-xl border border-[#f9bf8f]/40 bg-white p-1.5 shrink-0 group-hover:scale-105 transition"
                      />
                      <h4 className="font-bold text-xs sm:text-sm line-clamp-2 group-hover:text-[#0c831f] transition">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <span className="text-lg font-black">₹{product.price}</span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="text-xs text-[#7a6274] line-through ml-2">₹{product.originalPrice}</span>
                        )}
                      </div>
                      {!current ? (
                        <span className="text-[11px] font-semibold text-[#7a6274] bg-white px-2 py-0.5 rounded border border-[#f9bf8f]/60">
                          Stock checked at checkout
                        </span>
                      ) : available ? (
                        <span className="text-[11px] font-semibold text-[#0c831f] bg-[#f2fcf4] px-2 py-0.5 rounded border border-[#0c831f]/20">
                          In stock near you
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#e2434b] bg-[#fee9d7] px-2 py-0.5 rounded border border-[#f9bf8f]">
                          Not near you right now
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[#f9bf8f]/40 pt-3 flex items-center space-x-2">
                    <button
                      onClick={() => onAddToCart(product, 1)}
                      disabled={!available}
                      className="flex-1 bg-[#0c831f] hover:bg-[#0a6e1a] disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Add to cart</span>
                    </button>
                    <button
                      onClick={() => onSelectProduct(product)}
                      className="bg-white border border-[#f9bf8f]/70 hover:bg-[#fee9d7]/60 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
