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
  const { user, vendorStore, setVendorStatus, login, loginWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<'vendors' | 'products'>('products');
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbVendors, setDbVendors] = useState<any[]>([]);

  const fetchVendors = async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase.from('vendors').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setDbVendors(data);
      }
    } catch (e) {
      console.error('Error fetching admin vendors', e);
    }
  };

  const handleApproveVendor = async (vendorId: string) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase.from('vendors').update({ status: 'approved' }).eq('id', vendorId);
      if (!error) {
        setDbVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: 'approved' } : v));
        alert("Vendor approved! Their Seller Central is now unlocked.");
      }
    } catch (e: any) {
      alert("Error approving vendor: " + e.message);
    }
  };

  const handleRejectVendor = async (vendorId: string) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase.from('vendors').update({ status: 'rejected' }).eq('id', vendorId);
      if (!error) {
        setDbVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: 'rejected' } : v));
        alert("Vendor application rejected.");
      }
    } catch (e: any) {
      alert("Error rejecting vendor: " + e.message);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'products') {
      const fetchProducts = async () => {
        try {
          const { supabase } = await import('../lib/supabase');
          const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
          if (!error && data) {
            setDbProducts(data);
          }
        } catch (e) {
          console.error('Error fetching admin products', e);
        }
      };
      fetchProducts();
    } else if (activeTab === 'vendors') {
      fetchVendors();
    }
  }, [activeTab]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#111827] rounded-3xl border border-slate-800 p-8 text-center max-w-lg mx-auto shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center mb-4 text-rose-400">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Super Admin Access Required</h2>
        <p className="text-sm text-slate-400 mt-2 mb-6 max-w-sm">
          This operations console is restricted to verified Spaceborn platform administrators.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button 
            onClick={() => login('admin', 'admin@spaceborn.in', 'Spaceborn Super Admin')}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs sm:text-sm transition shadow-lg shadow-rose-900/30 cursor-pointer active:scale-95"
          >
            ⚡ Enter as Super Admin
          </button>
          <button 
            onClick={async () => {
              try {
                await loginWithGoogle('admin');
              } catch (e: any) {
                alert(e.message || 'Google login error');
              }
            }}
            className="py-3 px-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Google Sign In</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 text-slate-100">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-rose-500" />
              Super Admin Console
            </h1>
            <p className="text-slate-400 text-sm mt-1">Real-time oversight over Supabase database, vendor listings, and dark stores.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'products' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              Live Products ({dbProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'vendors' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              Vendor Network
            </button>
          </div>
        </div>

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800 shadow-xl space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-amber-500" /> Pending Partner Approvals
                </h2>
                <span className="text-xs font-mono text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
                  {dbVendors.filter(v => v.status === 'pending').length} Action Required
                </span>
              </div>
              
              {dbVendors.filter(v => v.status === 'pending').length === 0 ? (
                <div className="text-center py-10 border border-slate-800 rounded-xl bg-slate-900/40">
                  <Store className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-medium">No pending vendor applications in the database.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dbVendors.filter(v => v.status === 'pending').map((v) => (
                    <div key={v.id} className="border border-amber-800/40 rounded-xl p-4 bg-amber-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-base">{v.store_name}</span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-400 text-[10px] font-bold border border-amber-700/60">
                            PENDING REVIEW
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          <strong>Owner:</strong> {v.owner_name} • <strong>Email:</strong> {v.email} • <strong>Phone:</strong> {v.phone || 'N/A'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          <strong>Hub:</strong> {v.city} • <strong>GSTIN:</strong> <span className="font-mono text-slate-300">{v.gstin || 'Pending'}</span> • <strong>Applied:</strong> {new Date(v.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={() => handleApproveVendor(v.id)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve Partner
                        </button>
                        <button 
                          onClick={() => handleRejectVendor(v.id)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-rose-900/60 text-rose-400 hover:bg-rose-950/40 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* List of active vendors */}
            <div className="pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" /> Active Verified Seller Network
                </h2>
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full">
                  {dbVendors.filter(v => v.status === 'approved').length} Active Partners
                </span>
              </div>

              {dbVendors.filter(v => v.status === 'approved').length === 0 ? (
                <div className="text-center py-8 border border-slate-800 rounded-xl bg-slate-900/20 text-slate-500 text-xs">
                  No approved vendors yet. Approve pending applications above to unlock their seller portals.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dbVendors.filter(v => v.status === 'approved').map((v) => (
                    <div key={v.id} className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 relative">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-white text-sm">{v.store_name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 text-[10px] font-bold border border-emerald-800/60">ACTIVE</span>
                      </div>
                      <p className="text-xs text-slate-400">Owner: {v.owner_name}</p>
                      <p className="text-xs text-slate-400">Email: {v.email}</p>
                      <p className="text-xs text-slate-400">Hub: {v.city}</p>
                      <div className="text-[11px] font-mono text-emerald-400 bg-slate-950 px-2 py-1 rounded mt-2.5 inline-block border border-slate-800">
                        GSTIN: {v.gstin || 'Verified'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-rose-500" /> Supabase Live Catalog Directory
              </h2>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-md border border-slate-700">
                {dbProducts.length} Items Live in Postgres
              </span>
            </div>
            
            {dbProducts.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Connecting to Supabase products table...</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4 font-bold">SKU</th>
                      <th className="py-3 px-4 font-bold">Component Name</th>
                      <th className="py-3 px-4 font-bold">Vendor ID</th>
                      <th className="py-3 px-4 font-bold">Price</th>
                      <th className="py-3 px-4 font-bold">Live Stock</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {dbProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-slate-300 text-xs">{p.sku}</td>
                        <td className="py-3 px-4 font-semibold text-white">{p.name}</td>
                        <td className="py-3 px-4 text-slate-400 text-xs font-mono">{p.vendor_id}</td>
                        <td className="py-3 px-4 text-emerald-400 font-bold font-mono">₹{p.price}</td>
                        <td className="py-3 px-4 text-slate-300 font-mono">{p.stock} units</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${p.status === 'active' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-amber-950/60 text-amber-400 border-amber-800/60'}`}>
                            {p.status ? p.status.toUpperCase() : 'ACTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
