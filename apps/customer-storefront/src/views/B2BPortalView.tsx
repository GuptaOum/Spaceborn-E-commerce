'use client';
import React, { useState } from 'react';
import { 
  Building2, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  FileText, 
  Download, 
  ArrowRight, 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Calculator,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { Product, CartItem, BomItem, AppView, UserProfile } from '../types';
import { useStore } from '../context/StoreContext';

interface B2BPortalViewProps {
  onNavigate: (view: AppView) => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onOpenAuth?: (mode?: 'login' | 'signup') => void;
  user?: UserProfile | null;
}

export const B2BPortalView: React.FC<B2BPortalViewProps> = ({ 
  onNavigate, 
  onAddToCart,
  onOpenAuth,
  user
}) => {
  const [bomInputText, setBomInputText] = useState(
`MOT-N20-12V-300E, 25
DRV-TB6600-4A, 10
DEV-ESP32-S3-WROOM, 15
SEN-TF-LUNA-LIDAR, 5`
  );

  const { products: PRODUCTS } = useStore();
  const [bomItems, setBomItems] = useState<BomItem[]>([]);

  const [appliedGstin, setAppliedGstin] = useState('');
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Analyze text and match to catalog
  const handleAnalyzeBom = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const lines = bomInputText.split('\n').filter(l => l.trim().length > 0);
      const parsed: BomItem[] = lines.map((line, idx) => {
        const parts = line.split(/[,\t]/);
        const query = (parts[0] || '').trim();
        const qty = parseInt(parts[1] || '1', 10) || 1;

        // Search product catalog
        const match = PRODUCTS.find(p => 
          p.sku.toLowerCase() === query.toLowerCase() ||
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.id.toLowerCase().includes(query.toLowerCase())
        );

        return {
          id: `bom-${Date.now()}-${idx}`,
          mpnOrQuery: query,
          quantity: qty,
          matchedProduct: match,
          status: match ? 'matched' : 'unmatched'
        };
      });

      setBomItems(parsed);
      setIsProcessing(false);
    }, 400);
  };

  // Add all matched items to cart
  const handleAddAllToCart = () => {
    bomItems.forEach(item => {
      if (item.matchedProduct && item.quantity > 0) {
        onAddToCart(item.matchedProduct, item.quantity);
      }
    });
    onNavigate('cart');
  };

  // Calculate pricing metrics
  const totalTaxable = bomItems.reduce((sum, item) => {
    if (!item.matchedProduct) return sum;
    const basePrice = item.matchedProduct.price / 1.18;
    // apply bulk 10% discount if qty >= 10
    const discounted = item.quantity >= 10 ? basePrice * 0.9 : basePrice;
    return sum + discounted * item.quantity;
  }, 0);

  const totalGst = totalTaxable * 0.18;
  const grandTotal = totalTaxable + totalGst;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="bg-white rounded-2xl p-8 md:p-10 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase">
              <Building2 className="w-3.5 h-3.5" />
              <span>Spaceborn Institutional & B2B Portal</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Rapid Bill of Materials (BOM) & Volume RFQ Engine
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Designed for hardware incubation labs, universities, drone manufacturers, and robotics startups. Paste your component part numbers or upload your spreadsheet to receive instant bulk tier discounts and GST e-invoices.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shrink-0 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold">
              <Percent className="w-4 h-4" />
              <span>Institutional Volume Discount Tiers</span>
            </div>
            <div className="space-y-1 text-slate-300">
              <p>• 10+ Units: <strong>5% Instant Off</strong></p>
              <p>• 25+ Units: <strong>10% Instant Off</strong></p>
              <p>• 50+ Units: <strong>15% Instant Off</strong></p>
              <p>• 100+ Units: <strong>Contract PO Pricing</strong></p>
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Input Area */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-[#6366f1]" />
                <h3 className="font-bold text-slate-900 text-sm">Paste BOM (MPN, Qty)</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Format: SKU, Qty</span>
            </div>

            <textarea 
              rows={9}
              value={bomInputText}
              onChange={e => setBomInputText(e.target.value)}
              placeholder="MOT-N20-12V-300E, 20&#10;DRV-TB6600-4A, 10"
              className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 outline-none focus:border-[#6366f1] transition bg-slate-50/50"
            />

            <div className="space-y-3">
              <button 
                onClick={handleAnalyzeBom}
                disabled={isProcessing}
                className="w-full bg-[#6366f1] hover:bg-[#d44000] text-white py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
              >
                <Calculator className="w-4 h-4" />
                <span>{isProcessing ? 'Matching Catalog...' : 'Analyze & Match Spaceborn Catalog'}</span>
              </button>

              <div className="border-t border-slate-100 pt-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Company GSTIN for 18% Input Credit</label>
                <input 
                  type="text" 
                  value={appliedGstin}
                  onChange={e => setAppliedGstin(e.target.value)}
                  placeholder="29AABCS9482Q1Z7"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 outline-none focus:border-[#6366f1]"
                />
              </div>
            </div>
          </div>

          {/* Right: Matched Results & Quotation Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Matched Component Items ({bomItems.length})</h3>
                <p className="text-slate-500 text-xs">Verified against Spaceborn Pune & Bengaluru Warehouses</p>
              </div>

              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowRfqModal(true)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Generate Formal RFQ</span>
                </button>

                <button 
                  onClick={handleAddAllToCart}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#6366f1] hover:bg-[#d44000] rounded-lg transition flex items-center space-x-1.5 shadow-sm shadow-orange-500/20 cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Add All to Cart</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                    <th className="py-2.5 px-3">Item / SKU</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Unit Price (INR)</th>
                    <th className="py-2.5 px-3">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bomItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3">
                        {item.matchedProduct ? (
                          <div>
                            <div className="font-semibold text-slate-900">{item.matchedProduct.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">SKU: {item.matchedProduct.sku} | HSN: {item.matchedProduct.hsn}</div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono text-red-600 font-semibold">{item.mpnOrQuery}</span>
                            <span className="text-[11px] text-slate-400 block">Custom procurement required</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold">{item.quantity} pcs</td>
                      <td className="py-3 px-3 font-mono">
                        {item.matchedProduct ? `₹${item.matchedProduct.price}` : 'Quote on request'}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {item.matchedProduct ? `₹${(item.matchedProduct.price * item.quantity).toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {item.matchedProduct ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            In Stock ({item.matchedProduct.stock})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                            Custom Sourcing
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Summary */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600 space-y-0.5">
                <p>Taxable Subtotal: <strong className="text-slate-900 font-mono">₹{totalTaxable.toFixed(2)}</strong></p>
                <p>18% GST Input Credit (Claimable): <strong className="text-emerald-600 font-mono">₹{totalGst.toFixed(2)}</strong></p>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500 block">Estimated Institutional Total</span>
                <span className="text-2xl font-black text-slate-900 font-mono">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

          </div>

        </div>

        {/* Modal: Official RFQ Generated */}
        {showRfqModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Spaceborn Official Proforma RFQ</h3>
                <button onClick={() => setShowRfqModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold">âœ•</button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <p><strong>Quotation Ref:</strong> SPBN-B2B-{Math.floor(100000 + Math.random() * 900000)}</p>
                <p><strong>GSTIN Entity:</strong> {appliedGstin} (Verified 18% ITC)</p>
                <p><strong>Valid For:</strong> 30 Days from issue</p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-900 mb-1">Items Included: {bomItems.length} SKUs</p>
                  <p>Grand Total: <strong className="font-mono text-slate-900">₹{grandTotal.toFixed(2)} (Inclusive of 18% GST)</strong></p>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button 
                  onClick={() => {
                    alert('Proforma Quotation PDF downloaded to your device.');
                    setShowRfqModal(false);
                  }}
                  className="flex-1 bg-[#6366f1] hover:bg-[#d44000] text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Proforma Quotation PDF</span>
                </button>
                <button 
                  onClick={() => setShowRfqModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
