'use client';

import React from 'react';
import { Store, ShieldCheck, LogIn, LogOut, PackagePlus, Layers, MapPin, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SpacebornLogo } from './SpacebornLogo';

export const VendorAppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loginWithGoogle, logout, login } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle('vendor', 'Kanpur Hub');
    } catch (err: any) {
      alert(err.message || 'Google login failed');
    }
  };

  const handleDemoVendorLogin = () => {
    login('vendor', 'partner@apexrobotics.io', 'Apex Hardware Labs', 'Kanpur Hub');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800 font-sans">
      {/* Dedicated Vendor Top Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a] text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Logo & Portal Identity */}
          <div className="flex items-center space-x-3">
            <SpacebornLogo size="sm" />
            <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Store className="w-3.5 h-3.5" /> Seller Central
              </span>
              <span className="text-xs text-slate-400 hidden md:inline font-mono">
                Port 3001 • Vendor Hub
              </span>
            </div>
          </div>

          {/* Quick Metrics & Auth Area */}
          <div className="flex items-center space-x-3">
            {user && user.role === 'vendor' ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-white flex items-center justify-end gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{user.fullName || user.companyName || 'Verified Seller'}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{user.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition border border-slate-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDemoVendorLogin}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition"
                >
                  ⚡ One-Click Demo Vendor
                </button>
                <button
                  onClick={handleGoogleSignIn}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Google Sign In</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Vendor Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Vendor Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 text-xs text-center">
        <p className="font-semibold text-slate-300">Spaceborn Quick-Commerce Multi-Vendor Network</p>
        <p className="text-slate-500 text-[11px] mt-1">Direct Outbound Integration with Supabase ap-south-1 & Cloudflare Zero-Trust</p>
      </footer>
    </div>
  );
};
