'use client';
import React, { useState } from 'react';
import { CartItem, GstDetails } from '../types';
import { 
  Trash2, 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  FileCheck, 
  Lock, 
  Tag, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  Building,
  CreditCard,
  ShoppingBag
} from 'lucide-react';

interface CartReviewViewProps {
  cart: CartItem[];
  gstDetails: GstDetails;
  onUpdateGstDetails: (details: GstDetails) => void;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onProceedToCheckout: () => void;
  onContinueShopping: () => void;
  couponCode: string;
  onApplyCoupon: (code: string) => { success: boolean; message: string };
  discountPercent: number;
}

export const CartReviewView: React.FC<CartReviewViewProps> = ({
  cart,
  gstDetails,
  onUpdateGstDetails,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  onContinueShopping,
  couponCode,
  onApplyCoupon,
  discountPercent,
}) => {
  const [inputCoupon, setInputCoupon] = useState(couponCode || '');
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const totalGrossAmount = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = (totalGrossAmount * discountPercent) / 100;
  const netAmount = totalGrossAmount - discountAmount;

  const taxableBase = netAmount / 1.18;
  const gstAmount = netAmount - taxableBase;

  const shippingCost = totalGrossAmount >= 999 ? 0 : 90;
  const grandTotal = netAmount + shippingCost;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCoupon.trim()) return;
    const res = onApplyCoupon(inputCoupon.trim().toUpperCase());
    if (res.success) {
      setCouponFeedback({ type: 'success', text: res.message });
    } else {
      setCouponFeedback({ type: 'error', text: res.message });
    }
  };

  const handleGstinChange = (val: string) => {
    const formatted = val.toUpperCase().slice(0, 15);
    const isValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formatted);
    onUpdateGstDetails({
      ...gstDetails,
      gstin: formatted,
      verified: isValid,
      stateCode: formatted.slice(0, 2)
    });
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] py-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Your Cart is Currently Empty</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You have no components in your cart. Browse our catalog of over 15,000 electronics and robotics supplies.
            </p>
            <button
              onClick={onContinueShopping}
              className="mt-4 inline-flex items-center px-6 py-3 bg-[#6366f1] text-white text-xs font-bold rounded-xl hover:bg-[#d44000] transition cursor-pointer shadow-sm"
            >
              Browse Products Catalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-8">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* 3-Step Breadcrumb Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-center max-w-xl mx-auto">
            
            {/* Step 1 */}
            <div className="flex items-center space-x-2 text-[#0c831f]">
              <span className="w-7 h-7 rounded-full bg-[#0c831f] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                1
              </span>
              <span className="text-xs font-bold">Shopping Cart</span>
            </div>

            <div className="flex-1 h-0.5 bg-[#f9bf8f]/60 mx-3" />

            {/* Step 2 */}
            <div className="flex items-center space-x-2 text-[#7a6274]">
              <span className="w-7 h-7 rounded-full bg-white border border-[#f9bf8f] text-[#7a6274] flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span className="text-xs font-semibold">Shipping & GSTIN</span>
            </div>

            <div className="flex-1 h-0.5 bg-[#f9bf8f]/60 mx-3" />

            {/* Step 3 */}
            <div className="flex items-center space-x-2 text-[#7a6274]">
              <span className="w-7 h-7 rounded-full bg-white border border-[#f9bf8f] text-[#7a6274] flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span className="text-xs font-semibold">Payment & Invoice</span>
            </div>

          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Cart Items & GST Claim Card (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Cart Table Container */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Cart Items ({cart.reduce((s, i) => s + i.quantity, 0)} Units)
                </h2>
                <button
                  onClick={onContinueShopping}
                  className="text-xs font-bold text-[#0051d5] hover:underline cursor-pointer"
                >
                  + Add More Components
                </button>
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const itemTotal = item.unitPrice * item.quantity;
                  const itemExGst = (itemTotal / 1.18).toFixed(2);
                  return (
                    <div key={item.product.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      
                      {/* Left thumbnail & title */}
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-50 border border-slate-200 p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-mono text-slate-400 block">
                            SKU: {item.product.sku} | HSN: {item.product.hsn}
                          </span>
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                            {item.product.name}
                          </h3>
                          <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            In Stock ({item.product.stock} pcs)
                          </span>
                        </div>
                      </div>

                      {/* Middle: Stepper & Unit Price */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="w-7 h-8 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-9 h-8 flex items-center justify-center text-xs font-bold bg-white border-x border-slate-200">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                            className="w-7 h-8 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {/* Price Breakdown */}
                        <div className="text-right">
                          <span className="text-sm sm:text-base font-black text-slate-900">
                            ₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            @ ₹{item.unitPrice}/pc (Excl. ₹{itemExGst})
                          </span>
                        </div>

                        {/* Delete */}
                        <button
                          onClick={() => onRemoveItem(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

            {/* B2B Institutional GST Input Tax Credit Claim Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      B2B Corporate & Institutional GST Tax Credit
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Claim ₹{gstAmount.toFixed(2)} Input Tax Credit directly on your GSTR-2B filing
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gstDetails.enabled}
                    onChange={(e) => onUpdateGstDetails({ ...gstDetails, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#6366f1]"></div>
                </label>
              </div>

              {gstDetails.enabled && (
                <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Company / Legal Entity Name</label>
                    <input
                      type="text"
                      value={gstDetails.legalName}
                      onChange={(e) => onUpdateGstDetails({ ...gstDetails, legalName: e.target.value })}
                      placeholder="e.g. Apex Robotics Labs LLP"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800 focus:border-[#6366f1]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">15-Digit GSTIN Number</label>
                      {gstDetails.verified && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Valid Format</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={gstDetails.gstin}
                      onChange={(e) => handleGstinChange(e.target.value)}
                      placeholder="e.g. 29AABCA9482Q1Z7"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none font-mono font-bold text-slate-800 uppercase focus:border-[#6366f1]"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-800 text-[11px]">
                    <span className="flex items-center space-x-1.5 font-medium">
                      <FileCheck className="w-4 h-4 shrink-0" />
                      <span>State Code: {gstDetails.stateCode || '29'} (Karnataka) • Compliant with Indian E-Invoicing Portals</span>
                    </span>
                    <span className="font-mono font-bold">18% IGST Credit Enabled</span>
                  </div>
                </div>
              )}
            </div>

            {/* Coupon Code Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <form onSubmit={handleApplyCoupon} className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="flex-1">
                  <input
                    type="text"
                    value={inputCoupon}
                    onChange={(e) => setInputCoupon(e.target.value)}
                    placeholder="Enter Coupon / Promo Code (e.g. SPBN10 or MAKER5)"
                    className="w-full text-xs font-mono font-bold text-slate-800 uppercase outline-none placeholder:font-sans placeholder:font-normal"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-white hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Apply
                </button>
              </form>
              {couponFeedback && (
                <p className={`text-xs mt-2 font-medium ${couponFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {couponFeedback.text}
                </p>
              )}
            </div>

          </div>

          {/* Right: Sticky Order Summary (4 cols) */}
          <div className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
                Order Taxable Summary
              </h3>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Gross Product Total:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    ₹{totalGrossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Maker Coupon Discount ({discountPercent}%):</span>
                    <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Taxable Base Value:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    ₹{taxableBase.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>IGST / CGST+SGST (18%):</span>
                  <span className="font-mono font-semibold text-blue-700">
                    +₹{gstAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Air Express Shipping:</span>
                  <span className={`font-mono font-bold ${shippingCost === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {shippingCost === 0 ? 'FREE (Orders > ₹999)' : `₹${shippingCost}.00`}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">Total Payable:</span>
                  <div className="text-right">
                    <span className="text-xl font-black text-[#192737] font-mono">
                      ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Inclusive of all taxes</span>
                  </div>
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                onClick={onProceedToCheckout}
                className="w-full bg-[#6366f1] hover:bg-[#d44000] text-white py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-md shadow-orange-500/20 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              {/* Trust Badges */}
              <div className="pt-2 text-center space-y-2 border-t border-slate-100">
                <div className="flex items-center justify-center space-x-3 text-[11px] text-slate-500">
                  <span className="flex items-center space-x-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Secured by Razorpay</span>
                  </span>
                  <span>•</span>
                  <span>PCI-DSS Level 1</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Official GST Tax Invoice issued immediately upon payment clearance.
                </p>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
