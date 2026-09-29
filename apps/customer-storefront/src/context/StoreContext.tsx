'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAuth } from '@spaceborn/web-core/auth';
import type { CatalogProduct, NearbyStore } from '@spaceborn/web-core/types';
import type { CartItem, GstDetails, Product, UserProfile } from '../types';

export interface DeliveryLocation {
  label: string;
  area: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export const LOCATION_PRESETS: DeliveryLocation[] = [
  { label: 'Kanpur', area: 'Mall Road, Kanpur', pincode: '208001', latitude: 26.4499, longitude: 80.3319 },
  { label: 'Bengaluru', area: 'Koramangala 4th Block', pincode: '560034', latitude: 12.9352, longitude: 77.6245 },
  { label: 'Pune', area: 'Shivajinagar, Pune', pincode: '411005', latitude: 18.5308, longitude: 73.8475 },
  { label: 'Delhi', area: 'Connaught Place', pincode: '110001', latitude: 28.6315, longitude: 77.2167 },
  { label: 'Chennai', area: 'Taramani', pincode: '600113', latitude: 12.9863, longitude: 80.2432 },
];

export type CatalogStatus = 'loading' | 'ready' | 'unserviceable' | 'error';

interface StoreContextType {
  products: Product[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;

  location: DeliveryLocation;
  setLocation: (location: DeliveryLocation) => void;
  locateMe: () => Promise<void>;
  activeStore: NearbyStore | null;
  catalogStatus: CatalogStatus;
  catalogError: string | null;
  refreshCatalog: () => Promise<void>;

  cart: CartItem[];
  isCartDrawerOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  authLoading: boolean;
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile) => void;
  logoutUser: () => void;
  gstDetails: GstDetails;
  setGstDetails: (details: GstDetails) => void;

  wishlist: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  compareList: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const PLACEHOLDER_IMAGE = '/spaceborn-logo.png';
const MAX_PER_LINE = 50;

const KEYS = {
  cart: 'spaceborn_cart_v2',
  location: 'spaceborn_location_v2',
  wishlist: 'spaceborn_wishlist',
  profile: (uid: string) => `spaceborn_profile_${uid}`,
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function toProduct(p: CatalogProduct, store: NearbyStore): Product {
  return {
    id: p.id,
    vendorId: store.id,
    vendorName: store.name,
    city: store.city,
    name: p.name,
    sku: p.sku,
    category: p.categoryName,
    subCategory: '',
    price: p.price,
    originalPrice: p.mrp > p.price ? p.mrp : undefined,
    hsn: '',
    gstRate: p.gstRate,
    stock: p.stock,
    rating: 0,
    reviewsCount: 0,
    image: p.imageUrl ?? PLACEHOLDER_IMAGE,
    description: p.description,
    features: [],
    brand: p.brand ?? '',
    packageIncludes: [],
    specifications: p.specs ?? {},
    deliveryMins: store.etaMinutes,
  };
}

const EMPTY_GST: GstDetails = { enabled: false, gstin: '', legalName: '', stateCode: '', verified: false };

interface StoredCart {
  storeId: string | null;
  items: CartItem[];
}

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();

  const [location, setLocationState] = useState<DeliveryLocation>(LOCATION_PRESETS[0]);
  const [activeStore, setActiveStore] = useState<NearbyStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('loading');
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const [cart, setCart] = useState<StoredCart>({ storeId: null, items: [] });
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const [profileOverrides, setProfileOverrides] = useState<Partial<UserProfile>>({});
  const [gstDetails, setGstDetails] = useState<GstDetails>(EMPTY_GST);

  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [compareList, setCompareList] = useState<Product[]>([]);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedLocation = readJson<DeliveryLocation>(KEYS.location);
    if (savedLocation) setLocationState(savedLocation);
    const savedCart = readJson<StoredCart>(KEYS.cart);
    if (savedCart?.items) setCart(savedCart);
    const savedWishlist = readJson<Product[]>(KEYS.wishlist);
    if (savedWishlist) setWishlist(savedWishlist);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEYS.cart, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (!auth.user) {
      setProfileOverrides({});
      return;
    }
    setProfileOverrides(readJson<Partial<UserProfile>>(KEYS.profile(auth.user.uid)) ?? {});
  }, [auth.user?.uid]);

  const loadCatalog = useCallback(async (loc: DeliveryLocation) => {
    setCatalogStatus('loading');
    setCatalogError(null);
    try {
      const nearby = await api<{ stores: NearbyStore[] }>(`/stores/nearby?lat=${loc.latitude}&lng=${loc.longitude}`);
      const store = nearby.stores[0] ?? null;
      setActiveStore(store);
      if (!store) {
        setProducts([]);
        setCatalogStatus('unserviceable');
        return;
      }
      const res = await api<{ products: CatalogProduct[] }>(`/stores/${store.id}/products?limit=100`);
      setProducts(res.products.map((p) => toProduct(p, store)));
      // Each order is fulfilled by one store, so a cart from another store cannot be checked out.
      setCart((prev) => (prev.storeId && prev.storeId !== store.id ? { storeId: store.id, items: [] } : { ...prev, storeId: store.id }));
      setCatalogStatus('ready');
    } catch (err) {
      setCatalogError((err as Error).message);
      setCatalogStatus('error');
    }
  }, []);

  useEffect(() => {
    if (hydrated) void loadCatalog(location);
  }, [location, loadCatalog, hydrated]);

  const setLocation = (loc: DeliveryLocation) => {
    localStorage.setItem(KEYS.location, JSON.stringify(loc));
    setLocationState(loc);
  };

  const locateMe = () =>
    new Promise<void>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Location is not supported on this device.'));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            label: 'Current location',
            area: 'Near you',
            pincode: '',
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
          });
          resolve();
        },
        () => reject(new Error('Location permission was denied.')),
        { timeout: 10_000 },
      );
    });

  // Prices shown in the cart are refreshed from the live catalog; the server re-prices at checkout anyway.
  const cartItems = useMemo(
    () =>
      cart.items.map((item) => {
        const live = products.find((p) => p.id === item.product.id);
        return live ? { ...item, product: live, unitPrice: live.price } : item;
      }),
    [cart.items, products],
  );

  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const storeId = product.vendorId ?? prev.storeId;
      const items = prev.storeId && storeId !== prev.storeId ? [] : prev.items;
      const existing = items.find((i) => i.product.id === product.id);
      const limit = Math.min(product.stock, MAX_PER_LINE);
      const next = existing
        ? items.map((i) => (i.product.id === product.id ? { ...i, quantity: Math.min(limit, i.quantity + quantity) } : i))
        : [...items, { product, quantity: Math.min(limit, quantity), unitPrice: product.price }];
      return { storeId, items: next.filter((i) => i.quantity > 0) };
    });
    setIsCartDrawerOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) =>
    setCart((prev) => ({
      ...prev,
      items:
        quantity <= 0
          ? prev.items.filter((i) => i.product.id !== productId)
          : prev.items.map((i) =>
              i.product.id === productId ? { ...i, quantity: Math.min(quantity, MAX_PER_LINE, i.product.stock || MAX_PER_LINE) } : i,
            ),
    }));

  const removeFromCart = (productId: string) =>
    setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.product.id !== productId) }));

  const clearCart = () => setCart((prev) => ({ ...prev, items: [] }));

  const currentUser = useMemo<UserProfile | null>(() => {
    if (!auth.user) return null;
    return {
      id: auth.user.uid,
      role: auth.user.role,
      fullName: auth.user.name || auth.user.email?.split('@')[0] || 'Spaceborn user',
      email: auth.user.email ?? '',
      phone: '',
      accountType: 'individual',
      addresses: [],
      joinedDate: '',
      ...profileOverrides,
    };
  }, [auth.user, profileOverrides]);

  const setCurrentUser = (updated: UserProfile) => {
    if (!auth.user) return;
    const { id: _id, role: _role, email: _email, ...editable } = updated;
    localStorage.setItem(KEYS.profile(auth.user.uid), JSON.stringify(editable));
    setProfileOverrides(editable);
    if (updated.fullName || updated.phone) {
      void api('/me', {
        method: 'PATCH',
        body: {
          fullName: updated.fullName || undefined,
          phone: /^[6-9]\d{9}$/.test(updated.phone.replace(/\D/g, '').slice(-10)) ? updated.phone.replace(/\D/g, '').slice(-10) : undefined,
        },
      }).catch(() => undefined);
    }
  };

  const persistWishlist = (next: Product[]) => {
    localStorage.setItem(KEYS.wishlist, JSON.stringify(next));
    return next;
  };

  const value: StoreContextType = {
    products,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    selectedProduct,
    setSelectedProduct,
    quickViewProduct,
    setQuickViewProduct,
    location,
    setLocation,
    locateMe,
    activeStore,
    catalogStatus,
    catalogError,
    refreshCatalog: () => loadCatalog(location),
    cart: cartItems,
    isCartDrawerOpen,
    openCart: () => setIsCartDrawerOpen(true),
    closeCart: () => setIsCartDrawerOpen(false),
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    authLoading: auth.loading,
    currentUser,
    setCurrentUser,
    logoutUser: () => void auth.signOut(),
    gstDetails,
    setGstDetails,
    wishlist,
    addToWishlist: (product) =>
      setWishlist((prev) => (prev.some((p) => p.id === product.id) ? prev : persistWishlist([...prev, product]))),
    removeFromWishlist: (productId) => setWishlist((prev) => persistWishlist(prev.filter((p) => p.id !== productId))),
    compareList,
    addToCompare: (product) => setCompareList((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product])),
    removeFromCompare: (productId) => setCompareList((prev) => prev.filter((p) => p.id !== productId)),
    clearCompare: () => setCompareList([]),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
