'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, CartItem, UserProfile, Order, GstDetails } from '../types';
import { PRODUCTS, INITIAL_ORDERS } from '../data/products';
import { apiRequest } from '../lib/api';

interface StoreContextType {
  // Products
  products: Product[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  refreshCatalog: () => Promise<void>;

  // Cart
  cart: CartItem[];
  isCartDrawerOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  // User & Auth
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  loginUser: (user: UserProfile) => void;
  logoutUser: () => void;
  gstDetails: GstDetails;
  setGstDetails: (details: GstDetails) => void;

  // Location
  selectedCity: string;
  setSelectedCity: (city: string) => void;

  // Orders
  orders: Order[];
  addOrder: (order: Order) => void;

  // Wishlist & Compare
  wishlist: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  compareList: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const MOCK_VENDORS = [
  { id: 'v-1', name: 'ElectroHub', city: 'Bangalore', rating: 4.8, deliveryMins: 12 },
  { id: 'v-2', name: 'TechComponents', city: 'Pune', rating: 4.5, deliveryMins: 15 },
  { id: 'v-3', name: 'Kanpur Robotics', city: 'Kanpur', rating: 4.9, deliveryMins: 10 },
  { id: 'v-4', name: 'Delhi Makers', city: 'Delhi', rating: 4.2, deliveryMins: 20 },
  { id: 'v-5', name: 'Chennai Electronics', city: 'Chennai', rating: 4.7, deliveryMins: 14 }
];

// Instead of simple round-robin, we duplicate the catalog for the top 3 cities so they all have inventory!
// This makes the app actually "work" when you switch cities, showing distinct local stores.
const ENRICHED_PRODUCTS: Product[] = [];
const TARGET_CITIES = ['Kanpur', 'Bangalore', 'Pune'];

PRODUCTS.forEach((product) => {
  TARGET_CITIES.forEach((city) => {
    const localVendor = MOCK_VENDORS.find(v => v.city === city)!;
    // slightly randomize prices and stock per vendor to make it feel like a real marketplace
    const localPriceOffset = Math.floor(Math.random() * 20) - 10;
    
    ENRICHED_PRODUCTS.push({
      ...product,
      id: `${product.id}-${localVendor.id}`, // Unique ID per vendor listing
      vendorId: localVendor.id,
      vendorName: localVendor.name,
      city: localVendor.city,
      price: product.price + localPriceOffset,
      stock: Math.floor(Math.random() * 50) + 5,
      deliveryMins: localVendor.deliveryMins,
      rating: localVendor.rating
    });
  });
});

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Products Catalog State
  const [products, setProducts] = useState<Product[]>(ENRICHED_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('Kanpur');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // User & Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [gstDetails, setGstDetails] = useState<GstDetails>({
    enabled: true,
    legalName: 'Apex Robotics Labs LLP',
    gstin: '29AABCA9482Q1Z7',
    pan: 'AABCA9482Q',
    stateCode: '29',
    verified: true,
  });

  // Orders
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

  // Wishlist & Compare
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [compareList, setCompareList] = useState<Product[]>([]);

  // Hydrate client-side localStorage safely
  useEffect(() => {
    try {
      // Products
      const savedProducts = localStorage.getItem('spaceborn_custom_products');
      if (savedProducts) {
        const parsed = JSON.parse(savedProducts);
        setProducts([...parsed, ...PRODUCTS]);
      } else {
        setProducts(PRODUCTS);
      }

      // Cart
      const savedCart = localStorage.getItem('spaceborn_cart_items') || localStorage.getItem('robu_cart_items');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      } else {
        setCart([
          {
            product: PRODUCTS[0],
            quantity: 2,
            unitPrice: PRODUCTS[0].price,
          },
        ]);
      }

      // User
      const savedUser = localStorage.getItem('spaceborn_user_session');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        if (parsed.gstDetails) setGstDetails(parsed.gstDetails);
      } else {
        setCurrentUser({
          id: 'usr-b2b-01',
          fullName: 'Vikram Joshi',
          email: 'vikram.j@apexrobotics.io',
          phone: '+91 98450 82194',
          accountType: 'business',
          companyName: 'Apex Robotics Labs LLP',
          designation: 'Lead Hardware Architect',
          makerLevel: 'R&D Enterprise',
          joinedDate: 'Jan 2023',
          gstDetails: {
            enabled: true,
            legalName: 'Apex Robotics Labs LLP',
            gstin: '29AABCA9482Q1Z7',
            pan: 'AABCA9482Q',
            stateCode: '29',
            verified: true,
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
              isDefault: true,
            },
          ],
        });
      }

      // Wishlist
      const savedWishlist = localStorage.getItem('spaceborn_wishlist');
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
    } catch (e) {
      console.warn('Could not read from localStorage', e);
    }
  }, []);

  // Save Cart
  useEffect(() => {
    if (typeof window !== 'undefined' && cart.length > 0) {
      try {
        localStorage.setItem('spaceborn_cart_items', JSON.stringify(cart));
      } catch (e) {
        console.warn('Could not save cart', e);
      }
    }
  }, [cart]);

  // Save User
  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser) {
      try {
        localStorage.setItem('spaceborn_user_session', JSON.stringify(currentUser));
      } catch (e) {
        console.warn('Could not save user', e);
      }
    }
  }, [currentUser]);

  // Cart operations
  const openCart = () => setIsCartDrawerOpen(true);
  const closeCart = () => setIsCartDrawerOpen(false);

  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity, unitPrice: product.price }];
    });
    setIsCartDrawerOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('spaceborn_cart_items');
    }
  };

  // Vendor product operations
  const addProduct = (newProd: Product) => {
    setProducts((prev) => {
      const next = [newProd, ...prev];
      if (typeof window !== 'undefined') {
        try {
          const customOnly = next.filter((p) => !PRODUCTS.some((init) => init.id === p.id));
          localStorage.setItem('spaceborn_custom_products', JSON.stringify(customOnly));
        } catch (e) {
          console.warn('Could not save custom product', e);
        }
      }
      return next;
    });
  };

  const updateProduct = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const refreshCatalog = async () => {
    try {
      const result = await apiRequest<{ products: any[] }>('/products?limit=100&sortBy=newest');
      if (result.products?.length) {
        // Map backend products if available
      }
    } catch (e) {
      console.warn('Using bundled catalog:', e);
    }
  };

  // Auth operations
  const loginUser = (user: UserProfile) => {
    setCurrentUser(user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('spaceborn_user_session', JSON.stringify(user));
    }
  };

  const logoutUser = () => {
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('spaceborn_user_session');
      localStorage.removeItem('spaceborn_access_token');
    }
  };

  // Orders
  const addOrder = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
  };

  // Wishlist
  const addToWishlist = (product: Product) => {
    setWishlist((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      const next = [...prev, product];
      if (typeof window !== 'undefined') {
        localStorage.setItem('spaceborn_wishlist', JSON.stringify(next));
      }
      return next;
    });
  };

  const removeFromWishlist = (productId: string) => {
    setWishlist((prev) => {
      const next = prev.filter((p) => p.id !== productId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('spaceborn_wishlist', JSON.stringify(next));
      }
      return next;
    });
  };

  // Compare
  const addToCompare = (product: Product) => {
    setCompareList((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]));
  };

  const removeFromCompare = (productId: string) => {
    setCompareList((prev) => prev.filter((p) => p.id !== productId));
  };

  const clearCompare = () => setCompareList([]);

  // Derived products based on city
  const visibleProducts = products.filter(p => !p.city || p.city === selectedCity);

  return (
    <StoreContext.Provider
      value={{
        products: visibleProducts,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        selectedCity,
        setSelectedCity,
        selectedProduct,
        setSelectedProduct,
        quickViewProduct,
        setQuickViewProduct,
        addProduct,
        updateProduct,
        deleteProduct,
        refreshCatalog,
        cart,
        isCartDrawerOpen,
        openCart,
        closeCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        currentUser,
        setCurrentUser,
        loginUser,
        logoutUser,
        gstDetails,
        setGstDetails,
        orders,
        addOrder,
        wishlist,
        addToWishlist,
        removeFromWishlist,
        compareList,
        addToCompare,
        removeFromCompare,
        clearCompare,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
