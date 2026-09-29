'use client';

import React, { useState } from 'react';
import { Order, AppView } from '../types';
import { 
  Check, 
  FileText, 
  Search, 
  ChevronRight, 
  Package, 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface OrdersPortalViewProps {
  orders: Order[];
  onViewInvoice: (order: Order) => void;
  onNavigate: (view: AppView) => void;
}

export const OrdersPortalView: React.FC<OrdersPortalViewProps> = ({
  orders,
  onViewInvoice,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order>(orders[0] || null);

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.courier.awb.toLowerCase().includes(q) ||
      o.items.some(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
    );
  });

  const displayOrder = selectedOrder || filteredOrders[0] || orders[0];

  // 4 clean, simple timeline steps
  const steps = [
    { title: 'Order Placed', time: '14:22' },
    { title: 'Packed & QC', time: '15:10' },
    { title: 'Out for Delivery', time: '16:00' },
    { title: 'Delivered', time: 'Completed' },
  ];

  const getStepStatus = (stepIndex: number, currentStage: number) => {
    if (currentStage >= 4) return 'completed';
    if (stepIndex < currentStage) return 'completed';
    if (stepIndex === currentStage) return 'active';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Minimal Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[#f9bf8f]/40">
          <div>
            <div className="flex items-center space-x-1.5 text-xs text-[#7a6274] mb-1">
              <span 
                onClick={() => onNavigate('home')} 
                className="hover:text-[#e2434b] transition cursor-pointer"
              >
                Home
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#7a6274]/50" />
              <span className="font-semibold text-[#34222e]">Orders</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#34222e] tracking-tight">
              My Orders
            </h1>
            <p className="text-xs text-[#7a6274] mt-0.5">
              Track live component shipments and access official GST invoices
            </p>
          </div>

          {/* Clean Search Input */}
          <div className="w-full sm:w-72">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#7a6274] absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order # or component..."
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-[#f9bf8f]/70 rounded-xl text-xs font-medium text-[#34222e] placeholder:text-[#7a6274]/70 outline-none focus:border-[#34222e] transition shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Content Layout */}
        {filteredOrders.length === 0 ? (
          <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-12 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#fee9d7] mx-auto flex items-center justify-center text-[#7a6274]">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#34222e]">No orders found</h3>
            <p className="text-xs text-[#7a6274] max-w-sm mx-auto">
              No orders matched your search. Clear your search or browse components in the catalog.
            </p>
            <button
              onClick={() => { setSearchQuery(''); onNavigate('catalog'); }}
              className="mt-2 inline-flex items-center px-4 py-2 bg-[#34222e] text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Browse Catalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Orders List (5 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <span className="text-[11px] font-bold text-[#7a6274] uppercase tracking-wider block px-1">
                Order History ({filteredOrders.length})
              </span>

              <div className="space-y-2.5">
                {filteredOrders.map(order => {
                  const isSelected = order.id === displayOrder?.id;
                  const isDelivered = order.status === 'delivered';

                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white border-[#34222e] shadow-sm ring-1 ring-[#34222e]'
                          : 'bg-[#fffbf7] border-[#f9bf8f]/50 hover:bg-white hover:border-[#f9bf8f]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-mono font-bold text-[#34222e]">
                          {order.orderNumber}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          isDelivered
                            ? 'bg-[#f2fcf4] text-[#0c831f] border border-[#0c831f]/20'
                            : 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]'
                        }`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#7a6274]">
                        {order.date} • {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      </p>

                      <div className="mt-2 pt-2 border-t border-[#f9bf8f]/30 flex items-center justify-between text-xs">
                        <span className="font-bold text-[#34222e]">
                          ₹{order.pricing.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                          isSelected ? 'text-[#34222e]' : 'text-[#7a6274]'
                        }`}>
                          <span>View Details</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Active Order Details (8 cols) */}
            <div className="lg:col-span-8">
              {displayOrder && (
                <div className="bg-white rounded-3xl border border-[#f9bf8f]/60 shadow-xs overflow-hidden divide-y divide-[#f9bf8f]/30">
                  
                  {/* Order Top Bar */}
                  <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl font-mono font-black text-[#34222e]">
                          {displayOrder.orderNumber}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                          displayOrder.status === 'delivered'
                            ? 'bg-[#f2fcf4] text-[#0c831f] border border-[#0c831f]/20'
                            : 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]'
                        }`}>
                          {displayOrder.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-[#7a6274] mt-1">
                        Ordered on {displayOrder.date} • Delivered by {displayOrder.courier.provider}
                      </p>
                    </div>

                    <button
                      onClick={() => onViewInvoice(displayOrder)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#fee9d7]/50 hover:bg-[#fee9d7] text-[#34222e] border border-[#f9bf8f]/70 transition cursor-pointer self-start sm:self-auto active:scale-95"
                    >
                      <FileText className="w-4 h-4 text-[#7a6274]" />
                      <span>Download Invoice</span>
                    </button>
                  </div>

                  {/* Clean, Elegant Progress Stepper */}
                  <div className="p-6 space-y-4 bg-[#fffbf7]">
                    <div className="flex items-center justify-between text-xs font-medium text-[#7a6274]">
                      <span>Live Delivery Status:</span>
                      <span className="text-[#34222e] font-bold">
                        {displayOrder.courier.estimatedDelivery}
                      </span>
                    </div>

                    {/* Progress Bar with Dots */}
                    <div className="relative pt-2 pb-1">
                      <div className="absolute top-5 left-4 right-4 h-0.5 bg-[#f9bf8f]/50 -translate-y-1/2 z-0" />
                      
                      <div className="relative z-10 flex items-center justify-between">
                        {steps.map((step, idx) => {
                          const state = getStepStatus(idx, displayOrder.currentStageIndex);
                          const isDone = state === 'completed';
                          const isActive = state === 'active';

                          return (
                            <div key={idx} className="flex flex-col items-center text-center">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                isDone
                                  ? 'bg-[#34222e] text-white ring-4 ring-[#fee9d7]'
                                  : isActive
                                  ? 'bg-[#0c831f] text-white ring-4 ring-[#f2fcf4] animate-pulse'
                                  : 'bg-[#fee9d7] border-2 border-[#f9bf8f] text-[#7a6274]'
                              }`}>
                                {isDone ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : idx + 1}
                              </div>
                              <span className={`text-[11px] font-bold mt-2 ${
                                isDone || isActive ? 'text-[#34222e]' : 'text-[#7a6274]/70'
                              }`}>
                                {step.title}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-[11px] text-[#7a6274] pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-[#f9bf8f]/30">
                      <span>Waybill: <strong className="font-mono text-[#34222e]">{displayOrder.courier.awb}</strong></span>
                      <span>Current Hub: <strong className="text-[#34222e]">{displayOrder.courier.currentLocation}</strong></span>
                    </div>
                  </div>

                  {/* Components List */}
                  <div className="p-6 space-y-3">
                    <span className="text-[11px] font-bold text-[#7a6274] uppercase tracking-wider block">
                      Ordered Components ({displayOrder.items.length})
                    </span>

                    <div className="divide-y divide-[#f9bf8f]/30 border border-[#f9bf8f]/40 rounded-2xl overflow-hidden bg-white">
                      {displayOrder.items.map((item, i) => (
                        <div key={i} className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center space-x-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-white border border-[#f9bf8f]/40 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-[#34222e] truncate">
                                {item.name}
                              </h4>
                              <p className="text-[11px] text-[#7a6274] font-mono mt-0.5">
                                SKU: {item.sku} • Qty: {item.quantity}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs sm:text-sm font-bold text-[#34222e] block">
                              ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-[#7a6274] font-mono block">
                              ₹{item.unitPrice}/pc
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary & Address */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#fffbf7]">
                    
                    {/* Delivery Address */}
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[11px] font-bold text-[#7a6274] uppercase tracking-wider block mb-1">
                        Shipping Address
                      </span>
                      <p className="font-bold text-[#34222e] text-sm">
                        {displayOrder.shippingAddress.fullName}
                      </p>
                      {displayOrder.shippingAddress.companyName && (
                        <p className="text-xs font-semibold text-[#7a6274]">
                          {displayOrder.shippingAddress.companyName}
                        </p>
                      )}
                      <p className="text-[#7a6274] leading-relaxed">
                        {displayOrder.shippingAddress.addressLine1}
                        {displayOrder.shippingAddress.addressLine2 ? `, ${displayOrder.shippingAddress.addressLine2}` : ''}
                      </p>
                      <p className="text-[#7a6274]">
                        {displayOrder.shippingAddress.city}, {displayOrder.shippingAddress.state} - {displayOrder.shippingAddress.pincode}
                      </p>
                      <p className="text-[11px] text-[#7a6274] pt-1">
                        Contact: {displayOrder.shippingAddress.phone}
                      </p>
                    </div>

                    {/* Price Summary */}
                    <div className="space-y-2 text-xs">
                      <span className="text-[11px] font-bold text-[#7a6274] uppercase tracking-wider block mb-1">
                        Payment & Billing
                      </span>
                      
                      <div className="space-y-1.5 text-[#7a6274]">
                        <div className="flex justify-between">
                          <span>Payment Method:</span>
                          <span className="font-semibold text-[#34222e]">{displayOrder.payment.method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Subtotal (Taxable):</span>
                          <span className="font-mono text-[#34222e]">₹{displayOrder.pricing.subtotalTaxable.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GST (18% ITC Eligible):</span>
                          <span className="font-mono text-[#34222e]">
                            ₹{(displayOrder.pricing.igst || (displayOrder.pricing.cgst + displayOrder.pricing.sgst)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Express Delivery:</span>
                          <span className="font-semibold text-[#0c831f]">FREE (10-15 Min)</span>
                        </div>
                        
                        <div className="pt-2 border-t border-[#f9bf8f]/40 flex justify-between items-baseline font-bold text-[#34222e]">
                          <span className="text-xs font-bold">Total Paid:</span>
                          <span className="text-base font-black text-[#34222e] font-mono">
                            ₹{displayOrder.pricing.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
