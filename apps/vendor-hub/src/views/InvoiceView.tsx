'use client';
import React from 'react';
import { Order } from '../types';
import { Printer, Download, X, CheckCircle2, ShieldCheck, QrCode } from 'lucide-react';
import { SpacebornLogo } from '../components/SpacebornLogo';

interface InvoiceViewProps {
  order: Order;
  onClose: () => void;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({ order, onClose }) => {
  const isInterstate = order.gstDetails?.stateCode !== '27';
  const totalTaxable = order.pricing.subtotalTaxable;
  const totalGst = order.pricing.igst > 0 ? order.pricing.igst : (order.pricing.cgst + order.pricing.sgst);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col my-8">
        
        {/* Action Bar */}
        <div className="px-6 py-4 bg-[#34222e] text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm">Official GST Tax E-Invoice #{order.orderNumber}</span>
            <span className="text-[10px] bg-[#0c831f] text-white font-bold px-2 py-0.5 rounded">
              Paid via Stripe
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Tax Invoice Document */}
        <div className="p-8 space-y-6 text-slate-800 text-xs bg-white" id="printable-invoice">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <div className="mb-2">
                <SpacebornLogo size="sm" subtitle={false} />
              </div>
              <p className="font-bold text-slate-900 text-sm">Spaceborn Technologies Private Limited</p>
              <p className="text-slate-600">Plot 18, Phase 2, Electronic City Hardware Tech Zone</p>
              <p className="text-slate-600">Bengaluru, Karnataka - 560100, India</p>
              <p className="font-mono text-slate-700 mt-1">
                <strong>GSTIN:</strong> 29AABCS9482Q1Z7 | <strong>State:</strong> 29 - Karnataka
              </p>
              <p className="text-slate-500">Email: billing@spaceborn.in | Tel: +91 080 4912 8800</p>
            </div>

            {/* Invoice Meta & QR */}
            <div className="text-right space-y-1">
              <span className="text-base font-black text-slate-900 uppercase tracking-wider block">
                TAX INVOICE
              </span>
              <p className="font-mono"><strong>Invoice No:</strong> INV-2026-{order.orderNumber.replace('SPBN-', '')}</p>
              <p><strong>Invoice Date:</strong> {order.date}</p>
              <p className="font-mono"><strong>Place of Supply:</strong> {order.shippingAddress.state} ({order.gstDetails?.stateCode || '29'})</p>
              <p className="font-mono text-[10px] text-slate-500">
                <strong>Stripe Txn:</strong> {order.payment.transactionId}
              </p>
            </div>
          </div>

          {/* IRN & E-Waybill Verification */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Government E-Invoice Reference Number (IRN)
              </span>
              <p className="font-mono text-[10px] text-slate-700 break-all select-all">
                a8f7c9e0132db45e99824c015b76100234e6f98710ac82e145f8910bc472a912
              </p>
              <p className="text-[10px] text-emerald-700 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Digitally Signed & Validated on NIC GST Portal</span>
              </p>
            </div>
            <div className="w-14 h-14 bg-white border border-slate-300 rounded flex items-center justify-center shrink-0 ml-4">
              <QrCode className="w-12 h-12 text-slate-800" />
            </div>
          </div>

          {/* Bill-To and Ship-To */}
          <div className="grid grid-cols-2 gap-6 pt-2">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Billed To (Buyer)
              </span>
              <p className="font-bold text-slate-900 text-sm">
                {order.gstDetails?.legalName || order.shippingAddress.companyName || order.shippingAddress.fullName}
              </p>
              <p className="text-slate-600 mt-0.5">{order.shippingAddress.addressLine1}</p>
              <p className="text-slate-600">{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}</p>
              <p className="font-mono mt-1">
                <strong>GSTIN:</strong> {order.gstDetails?.gstin || 'Unregistered / B2C'}
              </p>
              <p className="text-slate-500">Contact: {order.shippingAddress.phone}</p>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Shipped To (Consignee)
              </span>
              <p className="font-bold text-slate-900 text-sm">{order.shippingAddress.fullName}</p>
              <p className="text-slate-600 mt-0.5">{order.shippingAddress.addressLine1}</p>
              <p className="text-slate-600">{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}</p>
              <p className="font-mono text-emerald-700 mt-1">
                <strong>BlueDart AWB:</strong> {order.courier.awb}
              </p>
              <p className="text-slate-500">Dispatch: BlueDart Apex Air Cargo</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="px-3 py-2 text-center w-8">#</th>
                  <th className="px-3 py-2">Item Description</th>
                  <th className="px-3 py-2 font-mono text-center">HSN</th>
                  <th className="px-3 py-2 text-center">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Rate</th>
                  <th className="px-3 py-2 text-right">Taxable Val</th>
                  <th className="px-3 py-2 text-right">IGST (18%)</th>
                  <th className="px-3 py-2 text-right">Total (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items.map((item, idx) => {
                  const rateExGst = (item.unitPrice / 1.18).toFixed(2);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <span className="font-bold block text-slate-900">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-center text-slate-600">{item.hsn}</td>
                      <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">₹{rateExGst}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">₹{item.taxableAmount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono text-blue-700">₹{item.gstAmount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                        ₹{item.total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tax Summary & Totals */}
          <div className="grid grid-cols-12 gap-6 pt-2">
            <div className="col-span-7 space-y-2 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="font-bold text-blue-900 block mb-1">Input Tax Credit (ITC) Certificate</span>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  This e-invoice is uploaded under Section 31 of CGST Act. The recipient is eligible to claim ₹{totalGst.toFixed(2)} in electronic credit ledger under GSTR-2B.
                </p>
              </div>

              <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                <p><strong>Payment Gateway:</strong> Stripe Payments Inc. (PCI-DSS Level 1)</p>
                <p><strong>Payment Status:</strong> PAID / AUTHORIZED ({(order.payment.cardBrand || 'Card').toUpperCase()} ending {order.payment.cardLast4 || '4242'})</p>
              </div>
            </div>

            <div className="col-span-5 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Total Taxable Value:</span>
                <span className="font-mono font-semibold">₹{totalTaxable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>Integrated GST (18%):</span>
                <span className="font-mono font-semibold">₹{totalGst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Air Express Shipping:</span>
                <span className="font-mono font-semibold">
                  {order.pricing.shipping === 0 ? 'FREE' : `₹${order.pricing.shipping.toFixed(2)}`}
                </span>
              </div>
              <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline font-bold text-sm text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-base">₹{order.pricing.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-[11px] text-slate-500">
            <div>
              <p>Terms: Goods bench-tested prior to dispatch. 10-Day Replacement Warranty on functional defects.</p>
              <p>This is a computer-generated tax invoice and requires no physical signature.</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900">For Spaceborn Technologies Pvt Ltd (spaceborn.in)</p>
              <p className="text-[10px] text-slate-400 mt-6">Authorized Signatory (Digital E-Seal)</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
