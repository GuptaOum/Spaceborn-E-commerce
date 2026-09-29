'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { OrdersPortalView } from '../../views/OrdersPortalView';
import { InvoiceView } from '../../views/InvoiceView';
import { Order } from '../../types';

export default function OrdersPage() {
  const router = useRouter();
  const { orders } = useStore();
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  return (
    <>
      <OrdersPortalView
        orders={orders}
        onViewInvoice={(order) => setInvoiceOrder(order)}
        onNavigate={(view) => {
          if (view === 'catalog') router.push('/catalog');
          else if (view === 'home') router.push('/');
          else router.push(`/${view}`);
        }}
      />

      {invoiceOrder && (
        <InvoiceView
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </>
  );
}
