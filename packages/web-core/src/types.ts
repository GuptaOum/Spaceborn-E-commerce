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
  /** False when the admin hid it in Storefront Studio: no new products go in, customers do not see it. */
  isVisible?: boolean;
}

/** Service coverage near the customer. Shops are anonymous: distance and speed only. */
export interface NearbyStore {
  distanceKm: number;
  etaMinutes: number;
}

/** Trust badges an admin can pin on a product. Customers see the label; the id is stored. */
export type ProductBadge = 'our_pick' | 'most_sold' | 'verified' | 'new_arrival';

export const PRODUCT_BADGES: Record<ProductBadge, { label: string; hint: string }> = {
  our_pick: { label: 'Our pick', hint: 'Spaceborn recommends this over similar parts.' },
  most_sold: { label: 'Most sold', hint: 'Among the top sellers in its category.' },
  verified: { label: 'Spaceborn verified', hint: 'Sample tested by Spaceborn before listing.' },
  new_arrival: { label: 'New arrival', hint: 'Recently added to the catalog.' },
};

export const PRODUCT_BADGE_IDS = Object.keys(PRODUCT_BADGES) as ProductBadge[];

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
  /** Sum of listed stock at every nearby store. `stock` stays the nearest store's own count. */
  nearbyStock?: number;
  storeCount?: number;
  badges: ProductBadge[];
  /** True when `badges` contains `our_pick`; kept for older callers. */
  isChoice?: boolean;
}

/**
 * A product as offered near the customer: the nearest in-stock shop's price and the pooled stock,
 * chosen by the server. The shop itself is never exposed.
 */
export interface CatalogOffer extends CatalogProduct {
  distanceKm: number;
  prepMinutes: number;
  etaMinutes: number;
  offerCount: number;
  minPrice: number | null;
}

export interface CartResolution {
  /** The nearest dispatching shop's distance and ETA. Null when nothing near here can serve the cart. */
  store: { distanceKm: number; etaMinutes: number } | null;
  lines: { productId: string; quantity: number; unitPrice: number | null; available: number; ok: boolean }[];
  /** Nothing near this location stocks these. */
  unavailable: string[];
  /** Stocked nearby, just not by the store supplying the rest of the cart. */
  elsewhere: string[];
  pricing: { itemsTotal: number; deliveryFee: number; platformFee: number; grandTotal: number } | null;
  nearbyStores: number;
  deliveries?: number;
  /** Which shop sends which items, nearest first. Empty until the whole cart can be filled. */
  dispatches?: {
    storeName: string;
    addressLine: string;
    city: string;
    pincode: string;
    distanceKm: number;
    etaMinutes: number;
    items: { productId: string; quantity: number }[];
  }[];
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
  /** Present for vendors and admins. Customers never receive the shop behind a delivery. */
  storeId?: string;
  storeName?: string;
  storePhone?: string;
  itemsTotal: number;
  deliveryFee: number;
  platformFee: number;
  grandTotal: number;
  deliveryAddress: DeliveryAddress;
  distanceKm: number;
  etaMinutes: number;
  /** Customer only, and only while the code the vendor requested at the door is still valid. */
  handoverOtp?: string;
  /** When the vendor last asked the server to send the code to the customer. */
  handoverOtpSentAt?: string | null;
  handoverOtpExpiresAt?: string | null;
  reservedUntil: string | null;
  cancelReason: string | null;
  placedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  paymentStatus: string | null;
  checkoutId?: string | null;
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

/** Written by the CAD worker. Estimates are a starting point for the vendor's quote, not a price. */
export interface FabFileAnalysis {
  status: 'done' | 'failed' | 'unsupported';
  metrics: {
    format: string;
    dimensionsMm: [number, number, number];
    volumeCm3: number;
    surfaceAreaCm2: number;
    triangles: number;
    watertight: boolean;
    fitsBuildVolume: boolean | null;
  } | null;
  estimate: {
    kind: string;
    material: string;
    massGrams: number;
    machineHours: number;
    priceInr: number;
  } | null;
  analyzedAt: string;
}

export interface FabFile {
  id: string;
  fileName: string;
  sizeBytes: number;
  analysis?: FabFileAnalysis | null;
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
  /** Customer view only: sum of the CAD worker's per-file estimates, until the maker quotes. */
  instantEstimateInr?: number | null;
  /** True when some files could not be priced, so the estimate covers only the rest. */
  instantEstimatePartial?: boolean | null;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ProductSubmission {
  id: string;
  storeId: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName?: string | null;
  brand: string | null;
  /** Manufacturer part number, if the vendor gave one. */
  mpn?: string | null;
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
  mpn?: string | null;
  /** Same manufacturer part number as the proposal. */
  mpnMatch?: boolean;
  score: number;
  textScore: number;
  imageScore: number | null;
  nameScore: number;
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

export interface ServingRegion {
  id: string;
  name: string;
  state: string;
  hubTag: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
  defaultRadiusKm: number;
  keyAreas: string[];
  pincodePrefix: string;
}

export const SERVING_REGIONS: ServingRegion[] = [
  {
    id: 'kanpur',
    name: 'Kanpur Hub',
    state: 'Uttar Pradesh',
    hubTag: 'IIT Kanpur & Central UP Tech Corridor',
    city: 'Kanpur',
    pincode: '208001',
    latitude: 26.4499,
    longitude: 80.3319,
    defaultRadiusKm: 15,
    keyAreas: ['Kalyanpur', 'IIT Kanpur', 'Mall Road', 'Rawatpur', 'Govind Nagar', 'Kakadeo'],
    pincodePrefix: '208',
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru Hub',
    state: 'Karnataka',
    hubTag: 'Silicon Plateau & Hardware Corridor',
    city: 'Bengaluru',
    pincode: '560034',
    latitude: 12.9352,
    longitude: 77.6245,
    defaultRadiusKm: 15,
    keyAreas: ['Koramangala', 'HSR Layout', 'Indiranagar', 'Electronic City', 'Whitefield', 'BTM'],
    pincodePrefix: '560',
  },
  {
    id: 'chennai',
    name: 'Chennai Hub',
    state: 'Tamil Nadu',
    hubTag: 'Automotive & Industrial Electronics Hub',
    city: 'Chennai',
    pincode: '600001',
    latitude: 13.0827,
    longitude: 80.2707,
    defaultRadiusKm: 15,
    keyAreas: ['Guindy', 'Adyar', 'Parrys Corner', 'OMR Tech Corridor', 'Velachery', 'Anna Nagar'],
    pincodePrefix: '600',
  },
  {
    id: 'pune',
    name: 'Pune Hub',
    state: 'Maharashtra',
    hubTag: 'Maharashtra Maker & Robotics Cluster',
    city: 'Pune',
    pincode: '411005',
    latitude: 18.5308,
    longitude: 73.8475,
    defaultRadiusKm: 15,
    keyAreas: ['Shivajinagar', 'Kothrud', 'Hinjewadi IT Park', 'Wakad', 'Pimpri-Chinchwad'],
    pincodePrefix: '411',
  },
  {
    id: 'delhi',
    name: 'Delhi NCR Hub',
    state: 'Delhi / NCR',
    hubTag: 'Northern Prototyping & Maker Labs',
    city: 'Delhi',
    pincode: '110001',
    latitude: 28.6315,
    longitude: 77.2167,
    defaultRadiusKm: 15,
    keyAreas: ['Connaught Place', 'Okhla Industrial Area', 'Noida Sector 62', 'Gurgaon Cyber City'],
    pincodePrefix: '110',
  },
];
