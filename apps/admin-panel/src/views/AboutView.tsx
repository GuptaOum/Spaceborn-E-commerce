'use client';
import React from 'react';
import { 
  Rocket, 
  ShieldCheck, 
  Cpu, 
  Microscope, 
  Building2, 
  Award, 
  Users, 
  ArrowRight,
  Plane,
  Sparkles,
  Zap,
  Globe2
} from 'lucide-react';
import { SpacebornLogo } from '../components/SpacebornLogo';
import { AppView } from '../types';

interface AboutViewProps {
  onNavigate: (view: AppView) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Hero Section */}
        <div className="relative rounded-2xl bg-[#0f172a] text-white p-8 md:p-14 overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute -right-16 -top-16 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-10 bottom-6 opacity-10 pointer-events-none hidden md:block">
            <svg viewBox="0 0 100 100" className="w-80 h-80" fill="none">
              <path d="M25 66 C35 55 45 42 51 33 H58 L68 58 H60.5 L53.5 41 C48 49 38 58 25 66 Z" fill="#FFFFFF"/>
            </svg>
          </div>

          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#6366f1] text-xs font-bold tracking-wide uppercase">
              <Rocket className="w-3.5 h-3.5" />
              <span>Next-Gen Hardware Infrastructure</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Fueling India's Aerospace, Deep Tech & Robotics Revolution.
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Spaceborn (<span className="text-white font-semibold">spaceborn.in</span>) is the specialized electronics, robotics, and aerospace component marketplace engineered for builders, space startups, defense research laboratories, and institutional robotics innovators.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button 
                onClick={() => onNavigate('catalog')}
                className="bg-[#6366f1] hover:bg-[#d44000] text-white px-6 py-3 rounded-lg text-sm font-bold flex items-center space-x-2 transition shadow-lg shadow-orange-500/25 cursor-pointer"
              >
                <span>Explore 15,000+ SKUs</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onNavigate('b2b')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-6 py-3 rounded-lg text-sm font-semibold transition cursor-pointer"
              >
                <span>Institutional Quotes & BOM Upload</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pillars of Engineering Quality */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-lg bg-orange-50 text-[#6366f1] flex items-center justify-center">
              <Microscope className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Cleanroom Bench QC Validation</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Every sensitive sensor, micro-encoder motor, and power controller undergoes waveform oscilloscope analysis, no-load current verification, and ESD anti-static sealing before dispatch.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Aerospace & Defense Reliability</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              From CubeSat telemetry microcontrollers to CNC planetary actuators, our components adhere to strict operational temperature bounds, mil-spec pinout tolerancing, and traceability.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">100% Tax Compliant B2B E-Invoicing</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Automated 18% GST input credit reconciliation with certified IRN numbers, QR code generation, and institutional purchase order support for corporate hardware teams.
            </p>
          </div>
        </div>

        {/* Facilities & Operations */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-bold text-slate-900">World-Class Hardware Infrastructure</h2>
            <p className="text-slate-500 text-sm mt-1">
              Strategically operating fulfillment centers and technical prototyping labs at India's premier aerospace and electronics corridors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                  Bengaluru Hub
                </span>
                <span className="text-xs text-slate-500 font-mono">Karnataka (State 29)</span>
              </div>
              <h4 className="font-bold text-slate-900 text-base">Spaceborn Aerospace & Hardware R&D Hub</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Plot 18, Phase 2, Electronic City Hardware Tech Zone, Bengaluru 560100. Home to our high-frequency RF test chambers, drone propulsion dynamometers, and institutional engineering consultations.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
                  Pune Hub
                </span>
                <span className="text-xs text-slate-500 font-mono">Maharashtra (State 27)</span>
              </div>
              <h4 className="font-bold text-slate-900 text-base">Spaceborn Central Mega-Fulfillment & QC Lab</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                S. No. 42/1, Chakan Industrial Tech Zone, Pune 410501. 40,000 sq.ft climate-controlled storage housing 15,000+ active component SKUs with same-day BlueDart priority air connectivity.
              </p>
            </div>
          </div>
        </div>

        {/* Impact Numbers */}
        <div className="bg-white rounded-2xl p-8 md:p-10 text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="pt-4 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-[#6366f1]">15,000+</div>
              <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Catalog SKUs</p>
            </div>
            <div className="pt-4 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-white">99.8%</div>
              <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">QC Pass Rate</p>
            </div>
            <div className="pt-4 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400">450+</div>
              <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">R&D Teams & Labs</p>
            </div>
            <div className="pt-4 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-blue-400">24 Hrs</div>
              <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Dispatch Window</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
