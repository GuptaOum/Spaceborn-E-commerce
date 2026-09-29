export interface Product {
  id: string;
  vendorId?: string; // Multi-vendor extension
  vendorName?: string;
  city?: string;     // E.g. 'Kanpur', 'Bangalore', 'Pune', 'Chennai', 'Gurugram'
  name: string;
  sku: string;
  category: string;
  subCategory: string;
  price: number; // in INR
  originalPrice?: number;
  hsn: string;
  gstRate: number; // e.g. 18
  stock: number;
  rating: number;
  reviewsCount: number;
  image: string;
  gallery?: string[];
  description: string;
  features: string[];
  brand: string;
  voltage?: string;
  rpm?: number;
  shaftType?: string;
  encoder?: boolean;
  packageIncludes: string[];
  tierPricing?: {
    minQty: number;
    maxQty?: number;
    price: number;
    savings: string;
  }[];
  specifications: Record<string, string>;
  pinout?: {
    pin: string;
    color: string;
    function: string;
    description: string;
  }[];
  datasheetUrl?: string;
  cadModelUrl?: string;
  badge?: string;
  deliveryMins?: number; // e.g. 10 or 15 mins
  packSize?: string; // e.g. '1 Unit', 'Pack of 2', '100g'
  flashDeal?: boolean;
  claimedPercent?: number; // e.g. 78% claimed
  videoUrl?: string; // product demo video
}

export interface ProductVideoReel {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  creatorName: string;
  creatorAvatar: string;
  creatorTag: string; // e.g., 'Spaceborn Robotics Lab' or 'Community Verified'
  likes: number;
  views: string;
  productId: string;
  productName: string;
  productPrice: number;
  productOriginalPrice?: number;
  productImage: string;
  discountPercent?: number;
  deliveryMinutes: number;
  highlights: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface Address {
  id: string;
  fullName: string;
  companyName?: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
  type: 'business' | 'residential';
}

export interface VendorStore {
  id: string;
  userId: string;
  storeName: string;
  city: string;
  status: 'pending' | 'approved' | 'rejected';
  joinedDate: string;
  gstin?: string;
  email?: string;
}

export interface UserProfile {
  id: string;
  role?: 'customer' | 'vendor' | 'admin';
  fullName: string;
  email: string;
  phone: string;
  accountType: 'individual' | 'business';
  companyName?: string;
  designation?: string;
  gstDetails?: GstDetails;
  addresses: Address[];
  makerLevel?: 'Student Maker' | 'Robotics Engineer' | 'R&D Enterprise' | 'Maker Pro';
  joinedDate: string;
  token?: string;
}

export interface GstDetails {
  enabled: boolean;
  gstin: string;
  legalName: string;
  pan?: string;
  stateCode: string;
  verified: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  hsn: string;
  quantity: number;
  unitPrice: number;
  taxableAmount: number;
  gstAmount: number;
  total: number;
  image: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  status: 'placed' | 'qc_tested' | 'dispatched' | 'destination_hub' | 'out_for_delivery' | 'delivered';
  currentStageIndex: number; // 0 to 4
  courier: {
    provider: string;
    awb: string;
    trackingUrl: string;
    estimatedDelivery: string;
    currentLocation: string;
  };
  shippingAddress: Address;
  gstDetails?: GstDetails;
  items: OrderItem[];
  payment: {
    method: string;
    paymentIntentId?: string;
    transactionId: string;
    status: 'succeeded' | 'pending' | 'failed';
    amount: number;
    currency: string;
    cardLast4?: string;
    cardBrand?: string;
  };
  pricing: {
    subtotalTaxable: number;
    igst: number;
    cgst: number;
    sgst: number;
    discount: number;
    shipping: number;
    grandTotal: number;
  };
  telemetryLogs: {
    timestamp: string;
    status: string;
    location: string;
    notes: string;
    completed: boolean;
  }[];
}

export interface FilterState {
  category: string;
  search: string;
  minPrice: number;
  maxPrice: number;
  voltage: string[];
  rpm: string[];
  shaftType: string[];
  encoder: string | null;
  inStockOnly: boolean;
  brand: string[];
  sortBy: 'featured' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

export type AppView = 
  | 'home' 
  | 'catalog' 
  | 'product' 
  | 'cart' 
  | 'checkout' 
  | 'orders' 
  | 'auth' 
  | 'profile'
  | 'about'
  | 'contact'
  | 'b2b'
  | 'vendor'
  | 'fabrication'
  | 'datasheets'
  | 'warranty'
  | 'wishlist'
  | 'compare'
  | 'admin';

export interface BomItem {
  id: string;
  mpnOrQuery: string;
  quantity: number;
  targetPrice?: number;
  matchedProduct?: Product;
  status: 'matched' | 'unmatched' | 'custom_procurement';
  notes?: string;
}
