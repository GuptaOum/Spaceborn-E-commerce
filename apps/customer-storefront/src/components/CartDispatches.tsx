'use client';

import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { api, ApiError } from '@spaceborn/web-core/api';
import type { CartResolution } from '@spaceborn/web-core/types';
import { useStore } from '../context/StoreContext';
import type { CartItem } from '../types';

export function CartDispatches({ cart }: { cart: CartItem[] }) {
  const { location } = useStore();
  const [resolution, setResolution] = useState<CartResolution | null>(null);
  const cartKey = cart.map((item) => `${item.product.id}:${item.quantity}`).join(',');

  useEffect(() => {
    if (!cart.length) return;
    const controller = new AbortController();
    api<CartResolution>('/catalog/resolve', {
      method: 'POST',
      signal: controller.signal,
      body: {
        lat: location.latitude,
        lng: location.longitude,
        items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      },
    })
      .then(setResolution)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 0)) setResolution(null);
      });
    return () => controller.abort();
    // cartKey already captures the items, so a new cart array does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, location.latitude, location.longitude]);

  const dispatches = resolution?.dispatches ?? [];
  if (!dispatches.length) return null;

  return (
    <div className="mt-1 space-y-1.5">
      {dispatches.map((dispatch, index) => (
        <div key={`${dispatch.storeName}-${index}`} className="flex items-start gap-1.5 text-[11px] text-sb-ink">
          <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#059669]" />
          <div className="min-w-0">
            <p className="font-bold">
              {dispatches.length > 1 ? `Part ${index + 1} from ` : 'Delivering from '}
              {dispatch.storeName}
            </p>
            <p className="text-sb-muted">
              {[dispatch.addressLine, dispatch.city, dispatch.pincode].filter(Boolean).join(', ')} · {dispatch.distanceKm} km away
            </p>
            {dispatches.length > 1 && (
              <p className="truncate text-sb-muted">
                {dispatch.items
                  .map((it) => `${it.quantity}x ${cart.find((c) => c.product.id === it.productId)?.product.name ?? 'Item'}`)
                  .join(', ')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
