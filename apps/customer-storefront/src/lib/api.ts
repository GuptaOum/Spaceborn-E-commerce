import { Order, UserProfile } from '../types';

const API_PREFIX = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) || '/api';
const TOKEN_KEY = 'spaceborn_access_token';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export class ApiClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export const clearAccessToken = () => localStorage.removeItem(TOKEN_KEY);

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new ApiClientError(payload?.message || 'Unable to reach the server.', response.status);
  }
  return payload.data;
}

type BackendUser = { _id: string; fullName: string; email: string; role?: 'customer' | 'admin'; createdAt?: string };

export function toUserProfile(user: BackendUser): UserProfile {
  return {
    id: user._id, role: user.role || 'customer', fullName: user.fullName, email: user.email, phone: '',
    accountType: 'individual', addresses: [],
    joinedDate: user.createdAt
      ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      : 'Recently joined',
  };
}

export async function login(email: string, password: string): Promise<UserProfile> {
  const result = await apiRequest<{ user: BackendUser; accessToken: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(TOKEN_KEY, result.accessToken);
  return toUserProfile(result.user);
}

export async function register(fullName: string, email: string, password: string): Promise<void> {
  await apiRequest<BackendUser>('/auth/register', {
    method: 'POST', body: JSON.stringify({ fullName, email, password }),
  });
}

export function toFrontendOrder(order: any): Order {
  const total = order.totalAmount || 0;
  return {
    id: order._id, orderNumber: `SPBN-${String(order._id).slice(-6).toUpperCase()}`,
    date: new Date(order.createdAt).toLocaleString('en-IN'),
    status: order.orderStatus === 'DELIVERED' ? 'delivered' : order.orderStatus === 'SHIPPED' ? 'dispatched' : 'placed',
    currentStageIndex: order.orderStatus === 'DELIVERED' ? 4 : order.orderStatus === 'SHIPPED' ? 2 : 0,
    courier: { provider: 'Pending allocation', awb: 'Pending', trackingUrl: '', estimatedDelivery: 'Pending', currentLocation: 'Spaceborn fulfillment' },
    shippingAddress: { id: order._id, fullName: '', email: '', phone: '', addressLine1: order.shippingAddress?.street || '', city: order.shippingAddress?.city || '', state: order.shippingAddress?.state || '', pincode: order.shippingAddress?.pincode || '', type: 'residential' },
    items: (order.items || []).map((item: any) => ({ productId: String(item.product), name: item.name, sku: '', hsn: '', quantity: item.quantity, unitPrice: item.price, taxableAmount: item.price * item.quantity / 1.18, gstAmount: item.price * item.quantity * .18 / 1.18, total: item.price * item.quantity, image: '' })),
    payment: { method: 'Razorpay', transactionId: '', status: order.paymentStatus === 'PAID' ? 'succeeded' : 'pending', amount: total, currency: 'INR' },
    pricing: { subtotalTaxable: total / 1.18, igst: total * .18 / 1.18, cgst: 0, sgst: 0, discount: 0, shipping: 0, grandTotal: total }, telemetryLogs: [],
  };
}
