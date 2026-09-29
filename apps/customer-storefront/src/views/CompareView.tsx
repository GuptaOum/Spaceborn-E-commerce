'use client';
import React, { useState } from 'react';
import { 
  RefreshCw, 
  Trash2, 
  Plus, 
  ShoppingCart, 
  Check, 
  X, 
  Zap, 
  Cpu, 
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { Product, AppView } from '../types';
import { useStore } from '../context/StoreContext';

interface CompareViewProps {
  compareList: Product[];
  onRemoveFromCompare: (productId: string) => void;
  onAddToCompare: (product: Product) => void;
  onClearCompare: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onNavigate: (view: AppView) => void;
  onSelectProduct: (product: Product) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  compareList,
  onRemoveFromCompare,
  onAddToCompare,
  onClearCompare,
  onAddToCart,
  onNavigate,
  onSelectProduct,
}) => {
  const { products: PRODUCTS } = useStore();
  const [selectedToAdd, setSelectedToAdd] = useState('');
  const activeProducts = compareList;

  const handleAddProduct = () => {
    if (!selectedToAdd) return;
    const found = PRODUCTS.find(p => p.id === selectedToAdd);
    if (found && !activeProducts.some(p => p.id === found.id)) {
      onAddToCompare(found);
      setSelectedToAdd('');
    }
  };

  // Collect all unique specification keys across comparing items
  const allSpecKeys = Array.from(
    new Set(activeProducts.flatMap(p => Object.keys(p.specifications)))
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Component Specification Comparison</h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Side-by-side electrical and mechanical tolerances for hardware selection
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedToAdd}
              onChange={e => setSelectedToAdd(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#6366f1] max-w-[220px] truncate cursor-pointer"
            >
              <option value="">Select component to compare...</option>
              {PRODUCTS.filter(p => !activeProducts.some(ap => ap.id === p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {compareList.length > 0 && (
              <button 
                type="button" 
                onClick={onClearCompare} 
                className="border border-rose-200 text-rose-700 hover:bg-rose-50 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear all</span>
              </button>
            )}
            <button
              onClick={handleAddProduct}
              disabled={!selectedToAdd}
              className="bg-[#6366f1] hover:bg-[#d44000] disabled:bg-slate-200 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Comparison Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="py-4 px-4 w-48 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  Feature / Parameter
                </th>
                {activeProducts.map(product => (
                  <th key={product.id} className="py-4 px-4 min-w-[220px] align-top">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                          {product.sku}
                        </span>
                        <button 
                          onClick={() => onRemoveFromCompare(product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center space-x-3">
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-14 h-14 object-contain rounded-lg border border-slate-100 bg-slate-50 p-1 shrink-0"
                        />
                        <div>
                          <h4 
                            onClick={() => {
                              onSelectProduct(product);
                              onNavigate('product');
                            }}
                            className="font-bold text-slate-900 hover:text-[#6366f1] cursor-pointer line-clamp-2"
                          >
                            {product.name}
                          </h4>
                          <span className="text-[11px] text-slate-500">{product.brand}</span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-lg font-black text-slate-900 font-mono">₹{product.price}</span>
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                          Stock: {product.stock}
                        </span>
                      </div>

                      <button
                        onClick={() => onAddToCart(product, 1)}
                        className="w-full bg-[#6366f1] hover:bg-[#d44000] text-white py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer shadow-xs"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Add to Cart</span>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {/* Category & Brand */}
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-600 bg-slate-50/30">Category</td>
                {activeProducts.map(p => (
                  <td key={p.id} className="py-3 px-4 font-medium text-slate-900">{p.category} &gt; {p.subCategory}</td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-4 font-semibold text-slate-600 bg-slate-50/30">HSN Code (18% GST)</td>
                {activeProducts.map(p => (
                  <td key={p.id} className="py-3 px-4 font-mono text-slate-700">{p.hsn}</td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-4 font-semibold text-slate-600 bg-slate-50/30">Rated Voltage</td>
                {activeProducts.map(p => (
                  <td key={p.id} className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {p.voltage || p.specifications['Operating Voltage'] || 'N/A'}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-4 font-semibold text-slate-600 bg-slate-50/30">Encoder Support</td>
                {activeProducts.map(p => (
                  <td key={p.id} className="py-3 px-4">
                    {p.encoder ? (
                      <span className="inline-flex items-center text-emerald-700 font-semibold space-x-1">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Integrated Magnetic Hall Encoder</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Dynamic Specifications */}
              {allSpecKeys.map(key => (
                <tr key={key} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-semibold text-slate-600 bg-slate-50/30">{key}</td>
                  {activeProducts.map(p => (
                    <td key={p.id} className="py-3 px-4 font-mono text-slate-800">
                      {p.specifications[key] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};