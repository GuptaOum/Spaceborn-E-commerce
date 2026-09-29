'use client';
import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Box, 
  Cpu, 
  ExternalLink, 
  Code2, 
  Eye, 
  CheckCircle2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Product, AppView } from '../types';
import { useStore } from '../context/StoreContext';

interface DatasheetLibraryViewProps {
  onNavigate: (view: AppView) => void;
  onSelectProduct: (p: Product) => void;
  products?: Product[];
}

export const DatasheetLibraryView: React.FC<DatasheetLibraryViewProps> = ({ 
  onNavigate, 
  onSelectProduct,
  products: productsProp,
}) => {
  const { products: storeProducts } = useStore();
  const PRODUCTS = productsProp ?? storeProducts;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeModalProduct, setActiveModalProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'specs' | 'pinout' | 'code'>('specs');

  const filteredProducts = PRODUCTS.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white rounded-2xl p-8 md:p-10 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase">
              <FileText className="w-3.5 h-3.5" />
              <span>Engineering Documentation Repository</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Technical Datasheets & 3D STEP CAD Library
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Verified mechanical dimensional drawings, electrical timing waveforms, KiCad schematic footprints, and Arduino / ESP-IDF drivers for rapid hardware development.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 shrink-0 text-xs space-y-1">
            <span className="text-slate-400">Total Engineering Assets:</span>
            <div className="text-lg font-black text-emerald-400 font-mono">1,840+ PDFs & STEPs</div>
            <span className="text-[11px] text-slate-400 block">Verified by Spaceborn QC Engineers</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by MPN, SKU, or Keyword (e.g. N20, TB6600, ESP32, LiDAR)..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] transition"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 whitespace-nowrap font-medium">Category:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-[#6366f1] cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Motors & Drivers">Motors & Drivers</option>
              <option value="Development Boards">Development Boards</option>
              <option value="Sensors & Modules">Sensors & Modules</option>
              <option value="Batteries & Power">Batteries & Power</option>
              <option value="Tools & Equipment">Tools & Equipment</option>
            </select>
          </div>
        </div>

        {/* Grid of Components */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <div 
              key={product.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {product.sku}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    QC Waveform Verified
                  </span>
                </div>

                <div className="flex items-center space-x-3 mb-3">
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="w-14 h-14 object-contain rounded-lg border border-slate-100 bg-slate-50 p-1 shrink-0" 
                  />
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2">{product.name}</h4>
                    <span className="text-[11px] text-slate-500">{product.brand}</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-2.5 space-y-1 text-[11px] text-slate-600 mb-3">
                  {Object.entries(product.specifications).slice(0, 3).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-400">{key}:</span>
                      <span className="font-mono text-slate-800 font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setActiveModalProduct(product);
                      setActiveTab('specs');
                    }}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Quick Preview</span>
                  </button>

                  <a 
                    href={product.datasheetUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!product.datasheetUrl) {
                        e.preventDefault();
                        alert(`Opening official technical datasheet for ${product.sku}`);
                      }
                    }}
                    className="w-full bg-orange-50 hover:bg-orange-100 text-[#6366f1] border border-orange-200 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF Sheet</span>
                  </a>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button 
                    onClick={() => {
                      onSelectProduct(product);
                      onNavigate('product');
                    }}
                    className="text-slate-500 hover:text-[#6366f1] transition flex items-center space-x-1 cursor-pointer"
                  >
                    <span>View in Store (₹{product.price})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono">HSN: {product.hsn}</span>
                </div>
              </div>

            </div>
          ))}
        </div>

        {/* Modal: Full Technical Viewer */}
        {activeModalProduct && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-mono text-[#6366f1] font-bold">{activeModalProduct.sku}</span>
                  <h3 className="font-bold text-slate-900 text-base">{activeModalProduct.name}</h3>
                </div>
                <button onClick={() => setActiveModalProduct(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">âœ•</button>
              </div>

              {/* Tabs */}
              <div className="flex space-x-2 border-b border-slate-200 text-xs font-semibold">
                <button 
                  onClick={() => setActiveTab('specs')}
                  className={`py-2 px-3 border-b-2 transition cursor-pointer ${activeTab === 'specs' ? 'border-[#6366f1] text-[#6366f1]' : 'border-transparent text-slate-500'}`}
                >
                  Electrical Specs
                </button>
                <button 
                  onClick={() => setActiveTab('pinout')}
                  className={`py-2 px-3 border-b-2 transition cursor-pointer ${activeTab === 'pinout' ? 'border-[#6366f1] text-[#6366f1]' : 'border-transparent text-slate-500'}`}
                >
                  Pinout & Wiring Diagram
                </button>
                <button 
                  onClick={() => setActiveTab('code')}
                  className={`py-2 px-3 border-b-2 transition cursor-pointer ${activeTab === 'code' ? 'border-[#6366f1] text-[#6366f1]' : 'border-transparent text-slate-500'}`}
                >
                  Driver Code Snippet
                </button>
              </div>

              {/* Tab Contents */}
              {activeTab === 'specs' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(activeModalProduct.specifications).map(([key, val]) => (
                      <div key={key} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">{key}</span>
                        <span className="font-mono font-semibold text-slate-900">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'pinout' && (
                <div className="space-y-3">
                  {activeModalProduct.pinout && activeModalProduct.pinout.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {activeModalProduct.pinout.map(p => (
                        <div key={p.pin} className="p-3 flex items-center justify-between text-xs bg-white">
                          <div className="flex items-center space-x-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color.toLowerCase() === 'white' ? '#e2e8f0' : p.color.toLowerCase() }} />
                            <strong className="text-slate-900 font-mono">{p.pin} ({p.function})</strong>
                          </div>
                          <span className="text-slate-500 text-[11px]">{p.description}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                      Standard standard breadboard header pinout. Refer to downloaded PDF for exact pin configurations.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'code' && (
                <div className="bg-[#0f172a] text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                  <pre>{`// Spaceborn.in Reference Driver for ${activeModalProduct.sku}
#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  Serial.println("Spaceborn Component Initialized: ${activeModalProduct.sku}");
  // Configure hardware pins
  pinMode(2, OUTPUT);
}

void loop() {
  // Read sensor / drive actuator loop
  digitalWrite(2, HIGH);
  delay(500);
  digitalWrite(2, LOW);
  delay(500);
}`}</pre>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button 
                  onClick={() => {
                    alert(`Downloading CAD STEP Model for ${activeModalProduct.sku}`);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Box className="w-4 h-4" />
                  <span>Download 3D CAD STEP</span>
                </button>

                <button 
                  onClick={() => {
                    onSelectProduct(activeModalProduct);
                    setActiveModalProduct(null);
                    onNavigate('product');
                  }}
                  className="bg-[#6366f1] hover:bg-[#d44000] text-white px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  View Product Page
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
