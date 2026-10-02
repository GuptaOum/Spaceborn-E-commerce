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
import { AppView } from '../types';

interface AboutViewProps {
  onNavigate: (view: AppView) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Hero Section */}
        <div className="relative rounded-2xl sm:rounded-3xl bg-[#34222e] text-white p-6 sm:p-10 md:p-14 overflow-hidden shadow-md border border-[#34222e]">
          <div className="absolute -right-16 -top-16 w-96 h-96 bg-[#e2434b]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-10 bottom-6 opacity-10 pointer-events-none hidden md:block">
            <svg viewBox="0 0 100 100" className="w-80 h-80" fill="none">
              <path d="M25 66 C35 55 45 42 51 33 H58 L68 58 H60.5 L53.5 41 C48 49 38 58 25 66 Z" fill="#FFFFFF"/>
            </svg>
          </div>

          <div className="relative z-10 max-w-3xl space-y-4 sm:space-y-5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#f8cb46]/15 border border-[#f8cb46]/30 text-[#f8cb46] text-xs font-bold tracking-wide uppercase">
              <Rocket className="w-3.5 h-3.5" />
              <span>Next-Gen Hardware Infrastructure</span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Fueling India's Aerospace, Deep Tech & Robotics Revolution.
            </h1>

            <p className="text-[#fee9d7]/80 text-xs sm:text-base leading-relaxed">
              Spaceborn (<span className="text-white font-semibold">spaceborn.in</span>) is the specialized electronics, robotics, and aerospace component marketplace engineered for builders, space startups, defense research laboratories, and institutional robotics innovators.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
              <button 
                onClick={() => onNavigate('catalog')}
                className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition shadow-xs cursor-pointer active:scale-95"
              >
                <span>Explore 15,000+ SKUs</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onNavigate('b2b')}
                className="bg-white/10 hover:bg-white/20 text-white border border-[#f9bf8f]/40 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                <span>Institutional Quotes & BOM Upload</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pillars of Engineering Quality */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#fee9d7] text-[#e2434b] flex items-center justify-center border border-[#f9bf8f]/60 shadow-xs">
              <Microscope className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-[#34222e] text-base sm:text-lg">Cleanroom Bench QC Validation</h3>
            <p className="text-[#7a6274] text-xs sm:text-sm leading-relaxed">
              Every sensitive sensor, micro-encoder motor, and power controller undergoes waveform oscilloscope analysis, no-load current verification, and ESD anti-static sealing before dispatch.
            </p>
          </div>

          <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#fee9d7] text-[#0c831f] flex items-center justify-center border border-[#f9bf8f]/60 shadow-xs">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-[#34222e] text-base sm:text-lg">Aerospace & Defense Reliability</h3>
            <p className="text-[#7a6274] text-xs sm:text-sm leading-relaxed">
              From CubeSat telemetry microcontrollers to CNC planetary actuators, our components adhere to strict operational temperature bounds, mil-spec pinout tolerancing, and traceability.
            </p>
          </div>

          <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#fee9d7] text-[#e2434b] flex items-center justify-center border border-[#f9bf8f]/60 shadow-xs">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-[#34222e] text-base sm:text-lg">100% Tax Compliant B2B E-Invoicing</h3>
            <p className="text-[#7a6274] text-xs sm:text-sm leading-relaxed">
              Automated 18% GST input credit reconciliation with certified IRN numbers, QR code generation, and institutional purchase order support for corporate hardware teams.
            </p>
          </div>
        </div>

        {/* Facilities & Operations */}
        <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-[#f9bf8f]/60 shadow-xs">
          <div className="max-w-2xl mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-[#34222e]">World-Class Hardware Infrastructure</h2>
            <p className="text-[#7a6274] text-xs sm:text-sm mt-1">
              Strategically operating fulfillment centers and technical prototyping labs at India's premier aerospace and electronics corridors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="border border-[#f9bf8f]/60 rounded-2xl p-5 sm:p-6 bg-white space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#f2fcf4] text-[#0c831f] border border-[#0c831f]/20">
                  Bengaluru Hub
                </span>
                <span className="text-xs text-[#7a6274] font-mono">Karnataka (State 29)</span>
              </div>
              <h4 className="font-bold text-[#34222e] text-sm sm:text-base">Spaceborn Aerospace & Hardware R&D Hub</h4>
              <p className="text-[#7a6274] text-xs leading-relaxed">
                Plot 18, Phase 2, Electronic City Hardware Tech Zone, Bengaluru 560100. Home to our high-frequency RF test chambers, drone propulsion dynamometers, and institutional engineering consultations.
              </p>
            </div>

            <div className="border border-[#f9bf8f]/60 rounded-2xl p-5 sm:p-6 bg-white space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#fcedde] text-[#e2434b] border border-[#f9bf8f]/60">
                  Pune Hub
                </span>
                <span className="text-xs text-[#7a6274] font-mono">Maharashtra (State 27)</span>
              </div>
              <h4 className="font-bold text-[#34222e] text-sm sm:text-base">Spaceborn Central Mega-Fulfillment & QC Lab</h4>
              <p className="text-[#7a6274] text-xs leading-relaxed">
                S. No. 42/1, Chakan Industrial Tech Zone, Pune 410501. 40,000 sq.ft climate-controlled storage housing 15,000+ active component SKUs with same-day BlueDart priority air connectivity.
              </p>
            </div>
          </div>
        </div>

        {/* Impact Numbers */}
        <div className="bg-[#34222e] rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-[#34222e] shadow-xs text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            <div className="pt-2 sm:pt-0">
              <div className="text-2xl sm:text-4xl font-black text-[#f8cb46]">15,000+</div>
              <p className="text-[11px] sm:text-xs font-medium text-[#fee9d7]/70 mt-1 uppercase tracking-wider">Catalog SKUs</p>
            </div>
            <div className="pt-4 sm:pt-0">
              <div className="text-2xl sm:text-4xl font-black text-white">99.8%</div>
              <p className="text-[11px] sm:text-xs font-medium text-[#fee9d7]/70 mt-1 uppercase tracking-wider">QC Pass Rate</p>
            </div>
            <div className="pt-4 sm:pt-0">
              <div className="text-2xl sm:text-4xl font-black text-[#0c831f]">450+</div>
              <p className="text-[11px] sm:text-xs font-medium text-[#fee9d7]/70 mt-1 uppercase tracking-wider">R&D Teams & Labs</p>
            </div>
            <div className="pt-4 sm:pt-0">
              <div className="text-2xl sm:text-4xl font-black text-[#e2434b]">24 Hrs</div>
              <p className="text-[11px] sm:text-xs font-medium text-[#fee9d7]/70 mt-1 uppercase tracking-wider">Dispatch Window</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
