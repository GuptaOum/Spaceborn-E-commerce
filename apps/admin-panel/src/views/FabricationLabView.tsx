'use client';
import React, { useState } from 'react';
import { 
  Cpu, 
  Layers, 
  Wrench, 
  UploadCloud, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  FileCode2, 
  ArrowRight 
} from 'lucide-react';
import { AppView, Product } from '../types';

interface FabricationLabViewProps {
  onNavigate: (view: AppView) => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
}

export const FabricationLabView: React.FC<FabricationLabViewProps> = ({ onNavigate, onAddToCart }) => {
  // Configurator state
  const [layers, setLayers] = useState<number>(2);
  const [quantity, setQuantity] = useState<number>(10);
  const [surfaceFinish, setSurfaceFinish] = useState<'hasl' | 'enig'>('enig');
  const [thickness, setThickness] = useState<string>('1.6mm');
  const [copperWeight, setCopperWeight] = useState<string>('1oz');
  const [soldermask, setSoldermask] = useState<string>('Space Matte Black');
  const [needSmt, setNeedSmt] = useState<boolean>(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Live price calculation
  const baseCost = layers === 2 ? 850 : layers === 4 ? 2200 : 4800;
  const finishCost = surfaceFinish === 'enig' ? 650 : 200;
  const smtCost = needSmt ? 1400 : 0;
  const unitCost = ((baseCost + finishCost + smtCost) / quantity) + 45;
  const totalCost = unitCost * quantity;
  const gstCost = totalCost * 0.18;
  const grandTotal = totalCost + gstCost;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="bg-[#0f172a] rounded-2xl p-8 md:p-12 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase">
              <Cpu className="w-3.5 h-3.5" />
              <span>Spaceborn Advanced Hardware Lab</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Aerospace PCB & Custom CNC Prototyping
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              From 24-hour quick-turn FR4 prototypes to aerospace-grade ENIG gold multilayer boards, mil-spec wire harness assemblies, and CNC precision motor mounts.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shrink-0 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold">
              <Clock className="w-4 h-4" />
              <span>Rapid Production SLA</span>
            </div>
            <p className="text-slate-300">2-Layer Quick-Turn: <strong>48 Hours Dispatch</strong></p>
            <p className="text-slate-300">4-Layer Immersion Gold: <strong>72 Hours Dispatch</strong></p>
            <p className="text-slate-300">Automated SMT Assembly: <strong>5 Business Days</strong></p>
          </div>
        </div>

        {/* Configurator & Estimation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Spec Configurator */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Custom Circuit Board Specifications</h3>
              <p className="text-slate-500 text-xs">Select your mechanical tolerances and electrical layer stackup.</p>
            </div>

            {/* Layer Count */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Layer Stackup</label>
              <div className="grid grid-cols-3 gap-3">
                {[2, 4, 6].map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLayers(l)}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                      layers === l 
                        ? 'border-[#6366f1] bg-orange-50 text-[#6366f1]' 
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {l} Layers {l === 2 ? '(Standard)' : l === 4 ? '(Multilayer RF)' : '(Aerospace)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Prototyping Batch Quantity</label>
              <div className="grid grid-cols-4 gap-3">
                {[5, 10, 25, 50].map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuantity(q)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                      quantity === q 
                        ? 'border-[#6366f1] bg-orange-50 text-[#6366f1]' 
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {q} pcs
                  </button>
                ))}
              </div>
            </div>

            {/* Surface Finish & Solder Mask */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Surface Metallurgy</label>
                <div className="space-y-2">
                  <label className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition ${surfaceFinish === 'enig' ? 'border-[#6366f1] bg-orange-50/50' : 'border-slate-200'}`}>
                    <span className="font-semibold text-slate-900">ENIG (Electroless Nickel Immersion Gold)</span>
                    <input type="radio" name="finish" checked={surfaceFinish === 'enig'} onChange={() => setSurfaceFinish('enig')} />
                  </label>
                  <label className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition ${surfaceFinish === 'hasl' ? 'border-[#6366f1] bg-orange-50/50' : 'border-slate-200'}`}>
                    <span className="font-semibold text-slate-900">Lead-Free HASL (Hot Air Solder Level)</span>
                    <input type="radio" name="finish" checked={surfaceFinish === 'hasl'} onChange={() => setSurfaceFinish('hasl')} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Soldermask Finish</label>
                <select 
                  value={soldermask} 
                  onChange={e => setSoldermask(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white outline-none focus:border-[#6366f1] cursor-pointer"
                >
                  <option value="Space Matte Black">Space Matte Black (Aerospace Stealth)</option>
                  <option value="Classic Industrial Green">Classic Industrial Green</option>
                  <option value="Precision Cobalt Blue">Precision Cobalt Blue</option>
                  <option value="Polar Cleanroom White">Polar Cleanroom White</option>
                </select>

                <div className="mt-4">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={needSmt} 
                      onChange={e => setNeedSmt(e.target.checked)}
                      className="rounded text-[#6366f1] focus:ring-[#6366f1]"
                    />
                    <span>Include SMT Pick-and-Place Component Stencil & Assembly</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Gerber Dropzone */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-[#6366f1] transition bg-slate-50/50">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800">
                {uploadedFileName ? (
                  <span className="text-emerald-600 flex items-center justify-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attached: {uploadedFileName}</span>
                  </span>
                ) : (
                  <span>Drag & Drop Gerber .ZIP or CAD STEP Model File</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Supported: RS-274X, ODB++, STEP, DXF (Max 50MB)</p>
              
              <label className="mt-3 inline-block bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition">
                Browse Files
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadedFileName(e.target.files[0].name);
                    }
                  }}
                />
              </label>
            </div>

          </div>

          {/* Right: Instant Estimation & Order Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider border-b border-slate-100 pb-3">
                Live Prototype Quotation
              </h4>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Stackup:</span>
                  <strong className="text-slate-900">{layers} Layers ({soldermask})</strong>
                </div>
                <div className="flex justify-between">
                  <span>Finish:</span>
                  <strong className="text-slate-900">{surfaceFinish.toUpperCase()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Quantity:</span>
                  <strong className="text-slate-900">{quantity} boards</strong>
                </div>
                <div className="flex justify-between">
                  <span>SMT Assembly:</span>
                  <strong className="text-slate-900">{needSmt ? 'Included' : 'Bare PCB'}</strong>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <span>Taxable Amount:</span>
                  <span className="font-mono text-slate-900 font-semibold">₹{totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>18% GST (Tax Credit):</span>
                  <span className="font-mono text-emerald-600 font-semibold">₹{gstCost.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total Prototyping Cost</span>
                  <span className="text-2xl font-black text-slate-900 font-mono">₹{grandTotal.toFixed(2)}</span>
                </div>
                <span className="text-[11px] text-slate-400 block text-right mt-0.5 font-mono">
                  (₹{(grandTotal / quantity).toFixed(2)} / unit)
                </span>
              </div>

              {submitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 space-y-1 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                  <p className="font-bold">Fabrication Order Initialized!</p>
                  <p className="text-[11px]">Lab Job ID: SPBN-FAB-{Math.floor(1000 + Math.random() * 9000)}. CAM validation team will confirm DRC within 2 hours.</p>
                </div>
              ) : (
                <button
                  onClick={() => setSubmitted(true)}
                  className="w-full bg-[#6366f1] hover:bg-[#d44000] text-white py-3 rounded-xl text-xs font-bold transition shadow-md shadow-orange-500/20 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <FileCode2 className="w-4 h-4" />
                  <span>Submit Gerber for Automated DRC & Quote</span>
                </button>
              )}
            </div>

            {/* Quality Certifications */}
            <div className="bg-white rounded-2xl p-5 text-white text-xs space-y-3">
              <div className="flex items-center space-x-2 text-orange-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Spaceborn Lab IPC Class 3 Standards</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                All fabrication complies with IPC-A-600 and IPC-A-610 Class 3 standards for high reliability electronics, featuring 100% automated optical inspection (AOI) and flying probe continuity testing.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
