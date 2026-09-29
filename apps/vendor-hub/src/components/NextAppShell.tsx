'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useStore } from '../context/StoreContext';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { QuickViewModal } from './QuickViewModal';
import { StickyCartDock } from './StickyCartDock';
import { AppView, Product } from '../types';

export const NextAppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();

  const {
    products,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    selectedProduct,
    setSelectedProduct,
    quickViewProduct,
    setQuickViewProduct,
    cart,
    isCartDrawerOpen,
    openCart,
    closeCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    currentUser,
    logoutUser,
    wishlist,
    compareList,
  } = useStore();

  const handleNavigate = (view: AppView) => {
    switch (view) {
      case 'home':
        router.push('/');
        break;
      case 'catalog':
        router.push('/catalog');
        break;
      case 'cart':
        router.push('/cart');
        break;
      case 'checkout':
        router.push('/checkout');
        break;
      case 'orders':
        router.push('/orders');
        break;
      case 'vendor':
        router.push('/vendor');
        break;
      case 'profile':
        router.push('/profile');
        break;
      case 'admin':
        router.push('/admin');
        break;
      case 'b2b':
        router.push('/b2b');
        break;
      case 'wishlist':
        router.push('/wishlist');
        break;
      case 'compare':
        router.push('/compare');
        break;
      case 'datasheets':
        router.push('/datasheets');
        break;
      case 'fabrication':
        router.push('/fabrication');
        break;
      case 'about':
        router.push('/about');
        break;
      case 'contact':
        router.push('/contact');
        break;
      case 'warranty':
        router.push('/warranty');
        break;
      case 'auth':
        router.push('/auth');
        break;
      case 'product':
        if (selectedProduct) {
          router.push(`/product/${selectedProduct.id}`);
        } else {
          router.push('/catalog');
        }
        break;
      default:
        router.push('/');
    }
  };

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    router.push(`/product/${prod.id}`);
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    router.push('/catalog');
  };

  const currentView = pathname.replace('/', '') || 'home';

  return (
    <div className="min-h-screen flex flex-col bg-[#fee9d7] font-sans antialiased text-[#34222e] selection:bg-[#f9bf8f] selection:text-[#34222e]">
      {/* Top Main Navigation Header */}
      <Header
        cart={cart}
        wishlistCount={wishlist.length}
        compareCount={compareList.length}
        user={currentUser}
        onOpenCart={openCart}
        onOpenAuth={(mode) => router.push(`/auth?mode=${mode || 'login'}`)}
        onSignOut={logoutUser}
        onNavigate={handleNavigate}
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        products={products}
        onSelectProduct={handleSelectProduct}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} onSelectCategory={handleSelectCategory} />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartDrawerOpen}
        onClose={closeCart}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onProceedToCart={() => {
          closeCart();
          router.push('/cart');
        }}
        onProceedToCheckout={() => {
          closeCart();
          router.push('/checkout');
        }}
      />

      {/* Quick View Modal */}
      {quickViewProduct && (
        <QuickViewModal
          product={quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onAddToCart={addToCart}
          onViewFullDetails={(prod) => {
            setQuickViewProduct(null);
            handleSelectProduct(prod);
          }}
        />
      )}

      {/* Sticky Bottom Quick-Commerce Cart Banner */}
      <StickyCartDock
        cart={cart}
        onOpenCart={openCart}
        currentView={currentView}
      />
    </div>
  );
};
