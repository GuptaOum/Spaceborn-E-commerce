import React, { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Product, CartItem, GstDetails, Order, UserProfile, AppView } from './types';
import { PRODUCTS, INITIAL_ORDERS } from './data/products';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { QuickViewModal } from './components/QuickViewModal';
import { CartDrawer } from './components/CartDrawer';
import { StickyCartDock } from './components/StickyCartDock';
import { Footer } from './components/Footer';

// Views
import { apiRequest, clearAccessToken, toFrontendOrder } from './lib/api';
import { HomeView } from './views/HomeView';
import { CatalogView } from './views/CatalogView';
import { ProductDetailView } from './views/ProductDetailView';
import { CartReviewView } from './views/CartReviewView';
import { CheckoutView } from './views/CheckoutView';
import { OrdersPortalView } from './views/OrdersPortalView';
import { InvoiceView } from './views/InvoiceView';
import { AuthView } from './views/AuthView';
import { AccountProfileView } from './views/AccountProfileView';
import { AboutView } from './views/AboutView';
import { ContactView } from './views/ContactView';
import { B2BPortalView } from './views/B2BPortalView';
import { VendorPortalView } from './views/VendorPortalView';
import { FabricationLabView } from './views/FabricationLabView';
import { DatasheetLibraryView } from './views/DatasheetLibraryView';
import { WarrantyPolicyView } from './views/WarrantyPolicyView';
import { WishlistView } from './views/WishlistView';
import { CompareView } from './views/CompareView';
import { AdminProductsView } from './views/AdminProductsView';

type BackendCatalogProduct = {
  _id: string;
  slug: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  images?: string[];
  isAvailable: boolean;
  specs?: Record<string, any>;
};

const storefrontCategory: Record<string, string> = {
  Motors: 'Motors & Drivers',
  Sensors: 'Sensors & Modules',
  Controllers: 'Development Boards',
  Batteries: 'Batteries & Chargers',
  Structural: 'Robotics & Mechanical',
  Accessories: 'Components & Hardware',
};

const toStorefrontProduct = (record: BackendCatalogProduct): Product => {
  const existing = PRODUCTS.find(product => product.sku === record.sku);
  const specs = record.specs || {};
  const category = storefrontCategory[record.category] || 'Components & Hardware';
  return {
    id: specs.sourceId || existing?.id || record.slug || record._id,
    name: record.name,
    sku: record.sku,
    category,
    subCategory: existing?.subCategory || category,
    price: record.price,
    originalPrice: existing?.originalPrice,
    hsn: existing?.hsn || '',
    gstRate: existing?.gstRate ?? 18,
    stock: record.stock,
    rating: existing?.rating ?? 0,
    reviewsCount: existing?.reviewsCount ?? 0,
    image: record.images?.[0] || existing?.image || '',
    gallery: existing?.gallery,
    description: record.description,
    features: existing?.features || [],
    brand: existing?.brand || 'Spaceborn',
    voltage: existing?.voltage,
    rpm: existing?.rpm,
    shaftType: existing?.shaftType,
    encoder: existing?.encoder,
    packageIncludes: existing?.packageIncludes || [],
    tierPricing: specs.tierPricing || existing?.tierPricing,
    specifications: existing?.specifications || {},
    pinout: existing?.pinout,
    datasheetUrl: existing?.datasheetUrl,
    cadModelUrl: existing?.cadModelUrl,
    badge: existing?.badge,
  };
};

export default function App() {
  // Navigation & View State
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  // Dynamic Catalog State with Vendor additions
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('spaceborn_custom_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        return [...parsed, ...PRODUCTS];
      }
    } catch (e) {
      console.warn('Could not read custom products', e);
    }
    return PRODUCTS;
  });

  const handleAddProduct = (newProd: Product) => {
    setProducts(prev => {
      const next = [newProd, ...prev];
      try {
        const customOnly = next.filter(p => !PRODUCTS.some(init => init.id === p.id));
        localStorage.setItem('spaceborn_custom_products', JSON.stringify(customOnly));
      } catch (e) {
        console.warn('Could not save custom product', e);
      }
      return next;
    });
  };

  const handleUpdateProduct = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0] || PRODUCTS[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);

  const refreshCatalog = async () => {
    try {
      const { supabase } = await import('./lib/supabase');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active');
        
      if (error) {
        console.error('Supabase query error:', error);
        return;
      }
      
      if (data && data.length > 0) {
        // Map Supabase columns to frontend Product format
        const mappedProducts = data.map((record: any) => {
          const existing = PRODUCTS.find(p => p.sku === record.sku) || ({} as any);
          return {
            ...existing, // Fallback to existing mock data for missing fields like images
            id: record.id,
            vendorId: record.vendor_id,
            name: record.name,
            sku: record.sku,
            category: record.category,
            subCategory: record.category, 
            price: Number(record.price),
            stock: Number(record.stock),
            hsn: existing.hsn || '85423100',
            gstRate: existing.gstRate || 18,
            rating: existing.rating || 5,
            reviewsCount: existing.reviewsCount || 1,
            image: existing.image || 'https://via.placeholder.com/150', // Use placeholder if no image
            gallery: existing.gallery || [],
            description: existing.description || 'Verified Component',
            features: existing.features || [],
            brand: existing.brand || 'Spaceborn Verified Partner'
          } as Product;
        });
        
        setProducts(mappedProducts);
      }
    } catch (error) {
      console.warn('Failed to fetch from Supabase. Falling back to local data:', error);
    }
  };

  useEffect(() => { void refreshCatalog(); }, []);

  // Authenticated User Session State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('spaceborn_user_session') || localStorage.getItem('robu_user_session');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not read user from localStorage', e);
    }
    // Default initial mock user for seamless demonstration
    return {
      id: 'usr-b2b-01',
      fullName: 'Vikram Joshi',
      email: 'vikram.j@apexrobotics.io',
      phone: '+91 98450 82194',
      accountType: 'business',
      companyName: 'Apex Robotics Labs LLP',
      designation: 'Lead Hardware Architect',
      makerLevel: 'R&D Enterprise Fellow',
      joinedDate: 'Jan 2023',
      gstDetails: {
        enabled: true,
        legalName: 'Apex Robotics Labs LLP',
        gstin: '29AABCA9482Q1Z7',
        pan: 'AABCA9482Q',
        stateCode: '29',
        verified: true
      },
      addresses: [
        {
          id: 'addr-1',
          fullName: 'Vikram Joshi',
          companyName: 'Apex Robotics Labs LLP',
          email: 'vikram.j@apexrobotics.io',
          phone: '+91 98450 82194',
          addressLine1: 'Plot 42, Electronic City Phase 1',
          addressLine2: 'Hardware Incubation Tech Park, Block C-3',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560100',
          type: 'business',
          isDefault: true
        }
      ]
    };
  });

  // Cart State Management (Local + Supabase Sync)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);

  // Initialize Cart from Supabase
  useEffect(() => {
    const initCart = async () => {
      try {
        const { supabase } = await import('./lib/supabase');
        // We use a guest ID or the logged in user ID
        const userId = currentUser?.id || 'guest-session';
        
        // 1. Find existing active cart
        let { data: cartData, error: cartError } = await supabase
          .from('carts')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();
          
        if (cartError && cartError.code !== 'PGRST116') throw cartError; // PGRST116 is not found

        let currentCartId = cartData?.id;

        // 2. If no cart exists, create one
        if (!currentCartId) {
          const { data: newCart, error: insertError } = await supabase
            .from('carts')
            .insert([{ user_id: userId, status: 'active' }])
            .select()
            .single();
            
          if (insertError) throw insertError;
          currentCartId = newCart.id;
        }

        setCartId(currentCartId);

        // 3. Fetch cart items
        const { data: itemsData, error: itemsError } = await supabase
          .from('cart_items')
          .select('*, product:products(*)')
          .eq('cart_id', currentCartId);

        if (itemsError) throw itemsError;

        if (itemsData && itemsData.length > 0) {
          const mappedItems = itemsData.map((item: any) => ({
             product: {
               id: item.product.id,
               name: item.product.name,
               sku: item.product.sku,
               price: Number(item.product.price),
               image: 'https://via.placeholder.com/150' // simplified for demo
             } as any,
             quantity: item.quantity,
             unitPrice: Number(item.product.price)
          }));
          setCart(mappedItems);
        } else {
           // Fallback to localStorage if Supabase is empty during development
           const saved = localStorage.getItem('spaceborn_cart_items');
           if (saved) setCart(JSON.parse(saved));
        }

      } catch (err) {
        console.error('Error syncing cart from Supabase:', err);
        // Fallback
        const saved = localStorage.getItem('spaceborn_cart_items');
        if (saved) setCart(JSON.parse(saved));
      }
    };
    initCart();
  }, [currentUser?.id]);

  // Sync to local storage and Supabase as backup
  useEffect(() => {
    localStorage.setItem('spaceborn_cart_items', JSON.stringify(cart));
    
    // Sync to Supabase in the background
    if (cartId && cart.length >= 0) {
      const syncToCloud = async () => {
        try {
          const { supabase } = await import('./lib/supabase');
          
          // Basic wipe and replace for prototype speed (in production use upsert)
          await supabase.from('cart_items').delete().eq('cart_id', cartId);
          
          if (cart.length > 0) {
            const itemsToInsert = cart.map(item => ({
              cart_id: cartId,
              product_id: item.product.id,
              quantity: item.quantity
            }));
            await supabase.from('cart_items').insert(itemsToInsert);
          }
        } catch (err) {
          console.error('Failed to sync cart to Supabase', err);
        }
      };
      void syncToCloud();
    }
  }, [cart, cartId]);

  // B2B GST Details State
  const [gstDetails, setGstDetails] = useState<GstDetails>({
    enabled: true,
    legalName: 'Apex Robotics Labs LLP',
    gstin: '29AABCA9482Q1Z7',
    pan: 'AABCA9482Q',
    stateCode: '29',
    verified: true
  });

  // Keep GST & user session synchronized
  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem('spaceborn_user_session', JSON.stringify(currentUser));
      } catch (e) {
        console.warn('Could not persist session', e);
      }
      if (currentUser.gstDetails) {
        setGstDetails(currentUser.gstDetails);
      }
    } else {
      localStorage.removeItem('spaceborn_user_session');
      localStorage.removeItem('robu_user_session');
    }
  }, [currentUser]);

  // Discount & Coupon State
  const [couponCode, setCouponCode] = useState<string>('MAKER5');
  const [discountPercent, setDiscountPercent] = useState<number>(5);

  // Wishlist & Compare State
  const [wishlist, setWishlist] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('spaceborn_wishlist');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not read wishlist', e);
    }
    return [PRODUCTS[1], PRODUCTS[3]];
  });

  const [compareList, setCompareList] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('spaceborn_compare');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not read compare list', e);
    }
    return [PRODUCTS[0], PRODUCTS[7]];
  });

  const handleRemoveFromWishlist = (productId: string) => {
    setWishlist(prev => {
      const updated = prev.filter(p => p.id !== productId);
      localStorage.setItem('spaceborn_wishlist', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAddToCompare = (product: Product) => {
    setCompareList(prev => {
      if (prev.some(p => p.id === product.id)) return prev;
      if (prev.length >= 4) return prev;
      const updated = [...prev, product];
      localStorage.setItem('spaceborn_compare', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearCompare = () => {
    setCompareList([]);
    localStorage.removeItem('spaceborn_compare');
  };

  const handleRemoveFromCompare = (productId: string) => {
    setCompareList(prev => {
      const updated = prev.filter(p => p.id !== productId);
      localStorage.setItem('spaceborn_compare', JSON.stringify(updated));
      return updated;
    });
  };

  // Orders State
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

  // Fetch live orders from backend on boot
  useEffect(() => {
    apiRequest<any[]>('/orders')
      .then(data => {
        if (data.length > 0) {
          setOrders(data.map(toFrontendOrder));
        }
      })
      .catch(err => {
        console.warn('Using local initial orders:', err);
      });
  }, []);

  // Auth Action Handlers
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.gstDetails) {
      setGstDetails(user.gstDetails);
    }
    setCurrentView('catalog');
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    clearAccessToken();
    setAuthMode('login');
    setCurrentView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = (mode: 'login' | 'signup' = 'login') => {
    setAuthMode(mode);
    setCurrentView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setCurrentUser(updated);
    if (updated.gstDetails) {
      setGstDetails(updated.gstDetails);
    }
  };

  // Helper to calculate tier unit price based on quantity
  const getTierPrice = (product: Product, quantity: number): number => {
    if (!product.tierPricing || product.tierPricing.length === 0) return product.price;
    for (let i = product.tierPricing.length - 1; i >= 0; i--) {
      const tier = product.tierPricing[i];
      if (quantity >= tier.minQty) {
        return tier.price;
      }
    }
    return product.price;
  };

  // Cart Handlers
  const handleAddToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newUnitPrice = getTierPrice(product, newQty);
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: newQty, unitPrice: newUnitPrice }
            : i
        );
      } else {
        const unitPrice = getTierPrice(product, quantity);
        return [...prev, { product, quantity, unitPrice }];
      }
    });
    setIsCartDrawerOpen(true);
  };

  const handleBuyNow = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newUnitPrice = getTierPrice(product, newQty);
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: newQty, unitPrice: newUnitPrice }
            : i
        );
      } else {
        const unitPrice = getTierPrice(product, quantity);
        return [...prev, { product, quantity, unitPrice }];
      }
    });
    setCurrentView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCart(prev =>
      prev.map(i => {
        if (i.product.id === productId) {
          const unitPrice = getTierPrice(i.product, quantity);
          return { ...i, quantity, unitPrice };
        }
        return i;
      })
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  // Navigation helper
  const handleNavigate = (view: AppView) => {
    if (view === 'admin' && currentUser?.role !== 'admin') {
      handleOpenAuth('login');
      return;
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Coupon Handler
  const handleApplyCoupon = (code: string): { success: boolean; message: string } => {
    const upper = code.trim().toUpperCase();
    if (upper === 'MAKER5' || upper === 'SPBN5') {
      setCouponCode(upper);
      setDiscountPercent(5);
      return { success: true, message: 'Maker coupon applied: 5% Off entire order!' };
    } else if (upper === 'SPBN10' || upper === 'SPACEBORN10') {
      setCouponCode(upper);
      setDiscountPercent(10);
      return { success: true, message: 'Spaceborn institutional coupon applied: 10% Off order!' };
    } else {
      return { success: false, message: 'Invalid promo code. Try SPBN5 or SPBN10.' };
    }
  };

  // Payment Success Handler
  const handlePaymentSuccess = (newOrder: Order) => {
    setOrders(prev => [newOrder, ...prev]);
    setCart([]); // clear cart
    setCurrentView('orders');
    setInvoiceModalOrder(newOrder); // open invoice automatically
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Product Selection
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentView('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const appType = process.env.NEXT_PUBLIC_APP_TYPE || 'PUBLIC';

  if (appType === 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 antialiased font-sans">
        <AdminProductsView onNavigate={() => {}} onCatalogChanged={async () => {}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fee9d7] text-[#34222e] font-sans antialiased selection:bg-[#e2434b] selection:text-white">
      
      {/* Top Header */}
      <Header
        cart={cart}
        wishlistCount={wishlist.length}
        compareCount={compareList.length}
        user={currentUser}
        onOpenCart={() => setIsCartDrawerOpen(true)}
        onOpenAuth={handleOpenAuth}
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        products={products}
        onSelectProduct={handleSelectProduct}
      />



      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomeView
            products={products}
            onSelectProduct={handleSelectProduct}
            onAddToCart={handleAddToCart}
            onQuickView={(p) => setQuickViewProduct(p)}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectCategory={handleSelectCategory}
            cart={cart}
          />
        )}

        {currentView === 'catalog' && (
          <CatalogView
            products={products}
            onSelectProduct={handleSelectProduct}
            onAddToCart={handleAddToCart}
            onQuickView={(p) => setQuickViewProduct(p)}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            searchQuery={searchQuery}
          />
        )}

        {currentView === 'product' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            allProducts={products}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onSelectProduct={handleSelectProduct}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentView === 'cart' && (
          <CartReviewView
            cart={cart}
            gstDetails={gstDetails}
            onUpdateGstDetails={setGstDetails}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onProceedToCheckout={() => {
              setCurrentView('checkout');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onContinueShopping={() => {
              setCurrentView('catalog');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            couponCode={couponCode}
            onApplyCoupon={handleApplyCoupon}
            discountPercent={discountPercent}
          />
        )}

        {currentView === 'checkout' && (
          <CheckoutView
            cart={cart}
            clearCart={() => setCart([])}
            currentUser={currentUser}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentView === 'orders' && (
          <OrdersPortalView
            orders={orders}
            onViewInvoice={(order) => setInvoiceModalOrder(order)}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentView === 'auth' && (
          <AuthView
            initialMode={authMode}
            onLoginSuccess={handleLoginSuccess}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentView === 'profile' && currentUser && (
          <AccountProfileView
            user={currentUser}
            onUpdateProfile={handleUpdateProfile}
            onSignOut={handleSignOut}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'admin' && currentUser?.role === 'admin' && (
          <AdminProductsView onNavigate={handleNavigate} onCatalogChanged={refreshCatalog} />
        )}

        {currentView === 'b2b' && (
          <B2BPortalView
            onNavigate={handleNavigate}
            onAddToCart={handleAddToCart}
            onOpenAuth={handleOpenAuth}
            user={currentUser}
          />
        )}

        {currentView === 'vendor' && (
          <VendorPortalView
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onSelectProduct={handleSelectProduct}
            onNavigate={handleNavigate}
            user={currentUser}
          />
        )}

        {currentView === 'fabrication' && (
          <FabricationLabView
            onNavigate={handleNavigate}
            onAddToCart={handleAddToCart}
          />
        )}

        {currentView === 'datasheets' && (
          <DatasheetLibraryView
            products={products}
            onSelectProduct={handleSelectProduct}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'warranty' && (
          <WarrantyPolicyView
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'wishlist' && (
          <WishlistView
            wishlist={wishlist}
            onRemoveFromWishlist={handleRemoveFromWishlist}
            onAddToCart={handleAddToCart}
            onNavigate={handleNavigate}
            onSelectProduct={handleSelectProduct}
          />
        )}

        {currentView === 'compare' && (
          <CompareView
            compareList={compareList}
            onRemoveFromCompare={handleRemoveFromCompare}
            onClearCompare={handleClearCompare}
            onAddToCompare={handleAddToCompare}
            onAddToCart={handleAddToCart}
            onNavigate={handleNavigate}
            onSelectProduct={handleSelectProduct}
          />
        )}

        {currentView === 'about' && (
          <AboutView
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'contact' && (
          <ContactView
            onNavigate={handleNavigate}
          />
        )}
      </main>

      {/* Cart Drawer Overlay */}
      <CartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onProceedToCart={() => {
          setCurrentView('cart');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onProceedToCheckout={() => {
          setCurrentView('checkout');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Quick View Modal */}
      {quickViewProduct && (
        <QuickViewModal
          product={quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onAddToCart={handleAddToCart}
          onViewFullDetails={handleSelectProduct}
        />
      )}

      {/* GST E-Invoice Modal */}
      {invoiceModalOrder && (
        <InvoiceView
          order={invoiceModalOrder}
          onClose={() => setInvoiceModalOrder(null)}
        />
      )}

      {/* Technical Footer */}
      <Footer
        onNavigate={handleNavigate}
        onSelectCategory={handleSelectCategory}
      />

      {/* Quick Commerce Sticky Cart Dock with Free Delivery Progress */}
      {!isCartDrawerOpen && (
        <StickyCartDock
          cart={cart}
          onOpenCart={() => setIsCartDrawerOpen(true)}
          currentView={currentView}
        />
      )}
    </div>
  );
}
