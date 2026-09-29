'use client';
import React, { useState } from 'react';
import { 
  ShieldCheck, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Truck, 
  Lock, 
  HelpCircle,
  Cpu
} from 'lucide-react';
import { AppView } from '../types';

interface WarrantyPolicyViewProps {
  onNavigate: (view: AppView) => void;
}

export const WarrantyPolicyView: React.FC<WarrantyPolicyViewProps> = ({ onNavigate }) => {
  const [orderId, setOrderId] = useState('');
  const [sku, setSku] = useState('');
  const [reason, setReason] = useState('bench_voltage_issue');
  const [notes, setNotes] = useState('');
  const [rmaGenerated, setRmaGenerated] = useState(false);

  const handleRmaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId && sku) {
      setRmaGenerated(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="bg-white rounded-2xl p-8 md:p-10 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Spaceborn Reliability Assurance</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Anti-Static ESD Standards & 10-Day Warranty Policy
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              We understand that hardware prototyping cannot afford defective silicon. Spaceborn operates rigorous pre-dispatch testing and provides hassle-free replacements for factory defects.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shrink-0 text-xs space-y-1">
            <span className="text-emerald-400 font-bold block">10-Day Hardware Replacement</span>
            <p className="text-slate-300">100% Pre-Shipment Multimeter Verified</p>
            <p className="text-slate-300">Prepaid BlueDart Reverse Pickup</p>
            <p className="text-slate-300">B2B GST Credit Note Adjustment</p>
          </div>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#6366f1] flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-bold text-slate-900 text-base">ESD Moisture Barrier Packaging</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              All CMOS, FPGA, and MOSFET components are vacuum-sealed with humidity indicator cards inside anti-static shielding bags to prevent electrostatic discharge damage during air transit.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-bold text-slate-900 text-base">Pre-Shipment Bench Testing</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Gear motors, stepper drivers, and power regulators are sampled and bench-tested under rated voltage conditions at our Chakan QC lab prior to logistics handover.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-bold text-slate-900 text-base">Instant RMA & Tax Credit Adjustment</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              In the rare event of an out-of-box component failure, our technical desk issues an immediate RMA number and arranges a reverse pickup or instantaneous replacement.
            </p>
          </div>
        </div>

        {/* RMA Generator Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Initiate Return Merchandise Authorization (RMA)</h3>
              <p className="text-slate-500 text-xs">For items delivered within the past 10 days.</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              Active Warranty Portal
            </span>
          </div>

          {rmaGenerated ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs text-emerald-700 uppercase tracking-wider font-bold">RMA Case Created</span>
                <h4 className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                  RMA-SPBN-{Math.floor(100000 + Math.random() * 900000)}
                </h4>
              </div>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Prepaid BlueDart return airway bill generated for Order <strong>{orderId}</strong> ({sku}). Our logistics courier will collect the package from your delivery address within 24 hours.
              </p>
              <button 
                onClick={() => {
                  setRmaGenerated(false);
                  setOrderId('');
                  setSku('');
                  setNotes('');
                }}
                className="bg-[#6366f1] hover:bg-[#d44000] text-white px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Create Another Request
              </button>
            </div>
          ) : (
            <form onSubmit={handleRmaSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Spaceborn Order ID *</label>
                  <input 
                    type="text"
                    required
                    value={orderId}
                    onChange={e => setOrderId(e.target.value)}
                    placeholder="e.g. SPBN-892411"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Component SKU / MPN *</label>
                  <input 
                    type="text"
                    required
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="e.g. MOT-N20-12V-300E"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Classification *</label>
                  <select 
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-[#6366f1] cursor-pointer"
                  >
                    <option value="bench_voltage_issue">Bench Voltage / Motor No-Rotate</option>
                    <option value="encoder_waveform">Encoder Waveform Missing / Distorted</option>
                    <option value="physical_transit">Transit Packaging Physical Damage</option>
                    <option value="incorrect_item">Incorrect Component Spec Dispatched</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bench Testing Observations / Multimeter Readings</label>
                <textarea 
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Tested at 12V DC bench supply; current draw was 0mA, no response on quadrature channels."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-[#6366f1]"
                />
              </div>

              <button 
                type="submit"
                className="bg-[#6366f1] hover:bg-[#d44000] text-white px-6 py-2.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Submit & Generate Prepaid BlueDart RMA</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
