'use client';

import React from 'react';
import { Shield, ShieldAlert, LogIn, LogOut, CheckCircle, Database, Server, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SpacebornLogo } from './SpacebornLogo';

export const AdminAppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loginWithGoogle, logout, login } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle('admin');
    } catch (err: any) {
      alert(err.message || 'Google login failed');
    }
  };

  const handleDemoAdminLogin = () => {
    login('admin', 'admin@spaceborn.in', 'Spaceborn Super Admin');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100 font-sans">
      {/* Super Admin Top Command Bar */}
      <header className="sticky top-0 z-50 bg-[#111827] border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          
          {/* Identity */}
          <div className="flex items-center space-x-3">
            <SpacebornLogo size="sm" />
            <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <span className="bg-rose-600 text-white font-black text-xs px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Shield className="w-3.5 h-3.5" /> Super Admin
              </span>
              <span className="text-xs text-slate-400 hidden md:inline font-mono">
                Port 3002 • Operations Console
              </span>
            </div>
          </div>

          {/* Security & Database Status Badges */}
          <div className="hidden lg:flex items-center space-x-2 text-xs">
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
              <Database className="w-3 h-3" /> Supabase Live
            </span>
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-sky-400 flex items-center gap-1 font-mono text-[11px]">
              <Server className="w-3 h-3" /> Zero-Trust Tunnel
            </span>
          </div>

          {/* Auth Action */}
          <div className="flex items-center space-x-2">
            {user && user.role === 'admin' ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-white flex items-center justify-end gap-1 text-rose-300">
                    <span>{user.fullName || 'Root Administrator'}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{user.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition border border-slate-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDemoAdminLogin}
                  className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-bold transition"
                >
                  ⚡ One-Click Super Admin
                </button>
                <button
                  onClick={handleGoogleSignIn}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Google Sign In</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Admin Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>

      {/* Admin Footer */}
      <footer className="bg-[#111827] border-t border-slate-800 text-slate-500 py-4 text-xs text-center">
        <p className="font-mono text-[11px]">Spaceborn Command & Control • Restricted Internal System • RBAC Enforced</p>
      </footer>
    </div>
  );
};
