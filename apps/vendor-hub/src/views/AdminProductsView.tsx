'use client';
import React, { useState } from 'react';
import { Shield, Users, Package, Store, CheckCircle, XCircle } from 'lucide-react';
import { AppView } from '../types';
import { useAuth } from '../context/AuthContext';

interface AdminProductsViewProps {
  onNavigate: (view: AppView) => void;
  onCatalogChanged: () => Promise<void>;
}

export function AdminProductsView({ onNavigate }: AdminProductsViewProps) {
  const { user, vendorStore, setVendorStatus } = useAuth();
  const [activeTab, setActiveTab] = useState<'vendors' | 'products'>('vendors');

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#fffbf7]">
        <Shield className="w-16 h-16 text-[#e2434b] mb-4" />
        <h2 className="text-xl font-bold text-[#34222e]">Admin Access Required</h2>
        <p className="text-sm text-[#7a6274] mt-2 mb-6 text-center max-w-md">
          Please sign in with a verified admin account to access the control panel.
        </p>
        <button 
          onClick={() => onNavigate('auth')}
          className="px-6 py-2.5 bg-[#34222e] text-white rounded-xl font-bold text-sm hover:bg-[#1f141b] transition shadow-md"
        >
          Sign In as Admin
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fee9d7] py-8">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-[#34222e] flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#e2434b]" />
              Super Admin Console
            </h1>
            <p className="text-[#7a6274] text-sm mt-1">Manage marketplace vendors, products, and platform settings.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('vendors')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'vendors' ? 'bg-[#34222e] text-white shadow-md' : 'bg-white text-[#7a6274] border border-[#f9bf8f] hover:bg-[#fffbf7]'
              }`}
            >
              Vendors
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'products' ? 'bg-[#34222e] text-white shadow-md' : 'bg-white text-[#7a6274] border border-[#f9bf8f] hover:bg-[#fffbf7]'
              }`}
            >
              Products
            </button>
          </div>
        </div>

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="bg-[#fffbf7] rounded-3xl p-6 border border-[#f9bf8f]/60 shadow-sm">
            <h2 className="text-lg font-bold text-[#34222e] mb-4 flex items-center gap-2">
              <Store className="w-5 h-5" /> Pending Vendor Approvals
            </h2>
            
            {vendorStore && vendorStore.status === 'pending' ? (
              <div className="border border-[#f9bf8f]/40 rounded-2xl p-4 bg-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#34222e] text-base">{vendorStore.storeName}</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-200">
                      PENDING REVIEW
                    </span>
                  </div>
                  <p className="text-xs text-[#7a6274]">Location: {vendorStore.city} • Applied: {new Date(vendorStore.joinedDate).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setVendorStatus('approved')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0c831f] text-white rounded-lg text-xs font-bold hover:bg-[#096618] transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button 
                    onClick={() => setVendorStatus('rejected')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ) : vendorStore && vendorStore.status === 'approved' ? (
              <div className="text-center py-10">
                <p className="text-[#7a6274] text-sm">Vendor has been approved. No pending applications.</p>
              </div>
            ) : (
              <div className="text-center py-10">
                <Store className="w-12 h-12 text-[#f9bf8f] mx-auto mb-3 opacity-50" />
                <p className="text-[#7a6274] text-sm font-medium">No pending vendor applications right now.</p>
              </div>
            )}
            
            {/* List of active vendors (mock) */}
            <h2 className="text-lg font-bold text-[#34222e] mt-10 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" /> Active Network Vendors
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="border border-[#f9bf8f]/40 rounded-2xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[#34222e]">ElectroHub</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#f2fcf4] text-[#0c831f] text-[10px] font-bold border border-[#0c831f]/20">ACTIVE</span>
                </div>
                <p className="text-xs text-[#7a6274] mb-3">Location: Bangalore</p>
                <div className="text-xs font-mono text-[#34222e] bg-[#fee9d7] px-2 py-1 rounded inline-block">124 Products</div>
              </div>
              
              <div className="border border-[#f9bf8f]/40 rounded-2xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[#34222e]">TechComponents Pune</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#f2fcf4] text-[#0c831f] text-[10px] font-bold border border-[#0c831f]/20">ACTIVE</span>
                </div>
                <p className="text-xs text-[#7a6274] mb-3">Location: Pune</p>
                <div className="text-xs font-mono text-[#34222e] bg-[#fee9d7] px-2 py-1 rounded inline-block">89 Products</div>
              </div>

              {vendorStore && vendorStore.status === 'approved' && (
                <div className="border border-[#0c831f]/40 rounded-2xl p-4 bg-[#f2fcf4] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-10 h-10 bg-[#0c831f]/10 rounded-bl-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#0c831f] rounded-full mt-[-10px] mr-[-10px]"></div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#0c831f]">{vendorStore.storeName}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#0c831f] text-white text-[10px] font-bold shadow-sm">NEW</span>
                  </div>
                  <p className="text-xs text-[#0c831f]/70 mb-3">Location: {vendorStore.city}</p>
                  <div className="text-xs font-mono text-[#0c831f] bg-white border border-[#0c831f]/20 px-2 py-1 rounded inline-block">0 Products</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="bg-[#fffbf7] rounded-3xl p-6 border border-[#f9bf8f]/60 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            <Package className="w-16 h-16 text-[#f9bf8f] mb-4" />
            <h2 className="text-xl font-bold text-[#34222e] mb-2">Global Catalog Management</h2>
            <p className="text-sm text-[#7a6274] max-w-md text-center">
              Since transitioning to a multi-vendor marketplace, product management is now handled by individual vendors in their Vendor Portal. 
              Admin oversight tools will be available here soon.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
