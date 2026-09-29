export type Role = 'customer' | 'vendor' | 'admin';

export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'accepted'
  | 'packing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'expired';

export type StoreStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Category {
  id: string;
  name: string;
}

export interface NearbyStore {
  id: string;
  name: string;
  city: string;
  addressLine: string;
  distanceKm: number;
  etaMinutes: number;
}

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  categoryId: string;
  categoryName: string;
  description: string;
  imageUrl: string | null;
  mrp: number;
  gstRate: number;
  specs: Record<string, string>;
  price: number;
  stock: number;
}

export interface DeliveryAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  storeId: string;
  storeName: string;
  storePhone: string;
  itemsTotal: number;
  deliveryFee: number;
  platformFee: number;
  grandTotal: number;
  deliveryAddress: DeliveryAddress;
  distanceKm: number;
  etaMinutes: number;
  handoverOtp?: string;
  reservedUntil: string | null;
  cancelReason: string | null;
  placedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  paymentStatus: string | null;
  items: OrderItem[];
  history?: { from: OrderStatus | null; to: OrderStatus; actorRole: string; note: string | null; at: string }[];
}

export interface Store {
  id: string;
  name: string;
  phone: string;
  gstin: string | null;
  addressLine: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  prepMinutes: number;
  status: StoreStatus;
  isOnline: boolean;
  reviewNote: string | null;
  createdAt: string;
}

export type ServiceKind = '3d_printing' | 'cnc';
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type FabStatus =
  | 'submitted'
  | 'quoted'
  | 'pending_payment'
  | 'in_production'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'declined'
  | 'cancelled'
  | 'expired';

export interface ServiceListing {
  id: string;
  storeId: string;
  kind: ServiceKind;
  title: string;
  description: string;
  materials: string[];
  maxXmm: number;
  maxYmm: number;
  maxZmm: number;
  startingPrice: number;
  turnaroundHours: number;
  status: ListingStatus;
  reviewNote: string | null;
  isActive: boolean;
  createdAt: string;
  storeName?: string;
  city?: string;
  distanceKm?: number;
  ownerEmail?: string;
}

export interface FabFile {
  id: string;
  fileName: string;
  sizeBytes: number;
}

export interface FabJob {
  id: string;
  jobNumber: number;
  listingId: string;
  storeId: string;
  storeName: string;
  storePhone: string;
  kind: ServiceKind;
  material: string;
  quantity: number;
  notes: string;
  status: FabStatus;
  quoteAmount: number | null;
  quoteNote: string | null;
  readyInHours: number | null;
  quoteExpiresAt: string | null;
  deliveryFee: number | null;
  platformFee: number | null;
  grandTotal: number | null;
  deliveryAddress: Partial<DeliveryAddress>;
  distanceKm: number;
  handoverOtp?: string;
  closeReason: string | null;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  paymentStatus: string | null;
  files: FabFile[];
}

export interface CheckoutPayment {
  provider: 'razorpay' | 'mock';
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string | null;
  status: string;
}
