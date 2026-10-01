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

/** A product as offered near the customer: the best nearby store's price/stock, chosen by the server. */
export interface CatalogOffer extends CatalogProduct {
  storeId: string;
  storeName: string;
  storeCity: string;
  distanceKm: number;
  prepMinutes: number;
  etaMinutes: number;
  offerCount: number;
  minPrice: number | null;
}

export interface CartResolution {
  store: { id: string; name: string; city: string; distanceKm: number; etaMinutes: number } | null;
  lines: { productId: string; quantity: number; unitPrice: number | null; available: number; ok: boolean }[];
  /** Nothing near this location stocks these. */
  unavailable: string[];
  /** Stocked nearby, just not by the store supplying the rest of the cart. */
  elsewhere: string[];
  pricing: { itemsTotal: number; deliveryFee: number; platformFee: number; grandTotal: number } | null;
  nearbyStores: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  label: string;
  area: string;
  pincode: string;
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
  deliveryRadiusKm?: number;
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
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  listingId: string;
  storeId: string;
  storeName: string;
  storePhone: string;
  storeCity?: string;
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

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ProductSubmission {
  id: string;
  storeId: string;
  name: string;
  description: string;
  categoryId: string;
  brand: string | null;
  mrp: number;
  price: number;
  stock: number;
  status: SubmissionStatus;
  reviewNote: string | null;
  productId: string | null;
  createdAt: string;
  hasImage: boolean;
  storeName?: string;
  city?: string;
  ownerEmail?: string | null;
}

export interface SimilarMatch {
  kind: 'catalog' | 'submission';
  id: string;
  name: string;
  sku: string | null;
  city: string | null;
  score: number;
  textScore: number;
  imageScore: number | null;
  likelyDuplicate: boolean;
}

/** What the signed-in admin may act on. `regions` are lower-cased store cities; null means every city. */
export interface AdminScope {
  email: string;
  regions: string[] | null;
  isOwner: boolean;
  isGlobal: boolean;
}

export interface AdminMember {
  email: string;
  displayName: string | null;
  regions: string[] | null;
  isOwner: boolean;
  addedBy: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  lastSeenAt: string | null;
}

export interface AdminRegion {
  city: string;
  stores: number;
}

export interface AuditEntry {
  id: number;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  city: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface CheckoutPayment {
  provider: 'razorpay' | 'mock';
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string | null;
  status: string;
}
