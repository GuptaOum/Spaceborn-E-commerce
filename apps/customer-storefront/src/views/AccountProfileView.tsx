'use client';

import React, { useState } from 'react';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  LogOut, 
  ShieldCheck, 
  Package, 
  Sparkles, 
  Edit3, 
  CheckCircle2, 
  Plus, 
  ChevronRight,
  LayoutDashboard,
  Receipt,
  Wrench,
  PhoneCall,
  ArrowRight,
  ShoppingBag,
  HelpCircle,
  Truck
} from 'lucide-react';
import { UserProfile, Address, GstDetails, AppView } from '../types';

interface AccountProfileViewProps {
  user: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onSignOut: () => void;
  onNavigate: (view: AppView) => void;
}

export function AccountProfileView({
  user,
  onUpdateProfile,
  onSignOut,
  onNavigate
}: AccountProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'addresses' | 'gst'>('overview');
  
  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [companyName, setCompanyName] = useState(user.companyName || '');
  const [designation, setDesignation] = useState(user.designation || '');

  // Add address state
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddrLine1, setNewAddrLine1] = useState('');
  const [newAddrCity, setNewAddrCity] = useState('');
  const [newAddrState, setNewAddrState] = useState('Karnataka');
  const [newAddrPincode, setNewAddrPincode] = useState('');
  const [newAddrType, setNewAddrType] = useState<'business' | 'residential'>('business');

  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setSavedSuccess(msg);
    setTimeout(() => setSavedSuccess(null), 3500);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...user,
      fullName: fullName.trim() || user.fullName,
      phone: phone.trim() || user.phone,
      companyName: companyName.trim() || undefined,
      designation: designation.trim() || undefined
    };
    onUpdateProfile(updated);
    setIsEditing(false);
    showNotification('Profile details updated successfully!');
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrLine1.trim() || !newAddrCity.trim() || !newAddrPincode.trim()) return;

    const newAddress: Address = {
      id: `addr-${Date.now()}`,
      fullName: user.fullName,
      companyName: user.companyName,
      email: user.email,
      phone: user.phone,
      addressLine1: newAddrLine1.trim(),
      city: newAddrCity.trim(),
      state: newAddrState,
      pincode: newAddrPincode.trim(),
      type: newAddrType,
      isDefault: user.addresses.length === 0
    };

    const updated: UserProfile = {
      ...user,
      addresses: [...user.addresses, newAddress]
    };

    onUpdateProfile(updated);
    setIsAddingAddress(false);
    setNewAddrLine1('');
    setNewAddrCity('');
    setNewAddrPincode('');
    showNotification('New delivery address saved!');
  };

  const handleSetDefaultAddress = (addrId: string) => {
    const updatedAddresses = user.addresses.map(a => ({
      ...a,
      isDefault: a.id === addrId
    }));
    onUpdateProfile({
      ...user,
      addresses: updatedAddresses
    });
    showNotification('Default delivery address updated!');
  };

  const handleDeleteAddress = (addrId: string) => {
    onUpdateProfile({
      ...user,
      addresses: user.addresses.filter(a => a.id !== addrId)
    });
    showNotification('Address removed.');
  };

  const defaultAddress = user.addresses.find(a => a.isDefault) || user.addresses[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-xs text-[#7a6274]">
        <button onClick={() => onNavigate('home')} className="hover:text-[#34222e] cursor-pointer transition-colors">
          Home
        </button>
        <span>/</span>
        <span className="font-semibold text-[#34222e]">Customer Dashboard</span>
      </div>

      {/* Success Notification Banner */}
      {savedSuccess && (
        <div className="p-3.5 bg-[#f2fcf4] border border-[#0c831f]/30 rounded-2xl text-[#0c831f] text-xs font-semibold flex items-center space-x-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#0c831f] shrink-0" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {/* User Welcome & Profile Header */}
      <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-[#34222e] text-[#fee9d7] border border-[#f9bf8f]/60 flex items-center justify-center font-black text-lg shadow-sm">
              {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-lg font-bold text-[#34222e]">{user.fullName}</h2>
                {user.accountType === 'business' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f2fcf4] text-[#0c831f] border border-[#0c831f]/30">
                    <Building2 className="w-3 h-3 mr-1" />
                    B2B Enterprise
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fee9d7] text-[#34222e] border border-[#f9bf8f]/60">
                    <Sparkles className="w-3 h-3 mr-1 text-[#ca8a04]" />
                    Maker Account
                  </span>
                )}
                {user.gstDetails?.verified && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f2fcf4] text-[#0c831f] border border-[#0c831f]/30">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    GST Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-[#7a6274] mt-0.5">
                {user.email} • {user.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 self-end sm:self-center">
            <button
              onClick={() => {
                setActiveTab('profile');
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#f9bf8f]/60 bg-white hover:bg-[#fee9d7]/40 text-[#34222e] text-xs font-semibold cursor-pointer transition shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#7a6274]" />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e2434b]/30 bg-white hover:bg-rose-50 text-[#e2434b] text-xs font-semibold cursor-pointer transition shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#34222e] text-[#fee9d7] shadow-sm'
              : 'bg-[#fffbf7] text-[#34222e] border border-[#f9bf8f]/60 hover:bg-[#fee9d7]/50'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Dashboard Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'profile'
              ? 'bg-[#34222e] text-[#fee9d7] shadow-sm'
              : 'bg-[#fffbf7] text-[#34222e] border border-[#f9bf8f]/60 hover:bg-[#fee9d7]/50'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile & Account</span>
        </button>

        <button
          onClick={() => setActiveTab('addresses')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'addresses'
              ? 'bg-[#34222e] text-[#fee9d7] shadow-sm'
              : 'bg-[#fffbf7] text-[#34222e] border border-[#f9bf8f]/60 hover:bg-[#fee9d7]/50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Saved Addresses ({user.addresses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('gst')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'gst'
              ? 'bg-[#34222e] text-[#fee9d7] shadow-sm'
              : 'bg-[#fffbf7] text-[#34222e] border border-[#f9bf8f]/60 hover:bg-[#fee9d7]/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>GST & Business Billing</span>
        </button>
      </div>

      {/* Tab 1: Dashboard Overview (Clean, Direct, Puzzle-Free) */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          
          {/* Quick Access Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Orders Card */}
            <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-5 shadow-xs flex flex-col justify-between hover:border-[#f9bf8f] transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-[#fee9d7] border border-[#f9bf8f]/60 flex items-center justify-center text-[#0c831f] mb-3.5">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#34222e]">My Orders & Live Tracking</h3>
                <p className="text-xs text-[#7a6274] mt-1 leading-relaxed">
                  Track ongoing shipments, view delivery OTPs, or re-order components with 1-click.
                </p>
              </div>
              <button
                onClick={() => onNavigate('orders')}
                className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-[#0c831f] hover:bg-[#0a6e1a] text-white text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <span>View My Orders</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Delivery Addresses Card */}
            <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-5 shadow-xs flex flex-col justify-between hover:border-[#f9bf8f] transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-[#fee9d7] border border-[#f9bf8f]/60 flex items-center justify-center text-[#e2434b] mb-3.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#34222e]">Delivery Addresses</h3>
                <p className="text-xs text-[#7a6274] mt-1 leading-relaxed">
                  {defaultAddress 
                    ? `Default: ${defaultAddress.addressLine1}, ${defaultAddress.city} (${defaultAddress.pincode})`
                    : 'Manage home, lab, and office drop points for superfast checkout.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('addresses')}
                className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-[#34222e] hover:bg-[#1a0f16] text-[#fee9d7] text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <span>Manage Addresses ({user.addresses.length})</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* GST & Business Billing Card */}
            <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-5 shadow-xs flex flex-col justify-between hover:border-[#f9bf8f] transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-[#fee9d7] border border-[#f9bf8f]/60 flex items-center justify-center text-[#ca8a04] mb-3.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#34222e]">GST & Tax Invoicing</h3>
                <p className="text-xs text-[#7a6274] mt-1 leading-relaxed">
                  {user.gstDetails?.verified 
                    ? `Active ITC: ${user.gstDetails.gstin} (${user.gstDetails.legalName})`
                    : 'Claim up to 18% Input Tax Credit on component and lab purchases.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('gst')}
                className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-white border border-[#f9bf8f]/70 hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <span>{user.gstDetails?.verified ? 'View GST Profile' : 'Configure GST Details'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 3D Printing & CNC Rapid Prototyping Card */}
            <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-5 shadow-xs flex flex-col justify-between hover:border-[#f9bf8f] transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-[#fee9d7] border border-[#f9bf8f]/60 flex items-center justify-center text-[#34222e] mb-3.5">
                  <Wrench className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#34222e]">3D Printing & CNC Lab</h3>
                <p className="text-xs text-[#7a6274] mt-1 leading-relaxed">
                  Upload 3D STL/STEP files for instant auto-slicing quotes. SLA resin, nylon FDM, and CNC aluminum milling.
                </p>
              </div>
              <button
                onClick={() => onNavigate('fabrication')}
                className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-white border border-[#f9bf8f]/70 hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <span>Get Instant Quote</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Start Shopping Catalog Card */}
            <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-5 shadow-xs flex flex-col justify-between hover:border-[#f9bf8f] transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-[#fee9d7] border border-[#f9bf8f]/60 flex items-center justify-center text-[#0c831f] mb-3.5">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#34222e]">Electronics Catalog</h3>
                <p className="text-xs text-[#7a6274] mt-1 leading-relaxed">
                  Browse microcontrollers, sensors, motors, batteries, and robotics kits with 10-15 minute local dispatch.
                </p>
              </div>
              <button
                onClick={() => onNavigate('catalog')}
                className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-white border border-[#f9bf8f]/70 hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <span>Browse Store Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Support Card */}
            <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-5 shadow-xs flex flex-col justify-between hover:border-[#f9bf8f] transition-all">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-[#fee9d7] border border-[#f9bf8f]/60 flex items-center justify-center text-[#e2434b] mb-3.5">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#34222e]">Customer Support</h3>
                <p className="text-xs text-[#7a6274] mt-1 leading-relaxed">
                  Need help with component selection or order updates? Call toll-free or message our engineer team.
                </p>
                <div className="mt-2 text-xs font-mono font-bold text-[#34222e]">
                  📞 1800 266 0199
                </div>
              </div>
              <button
                onClick={() => onNavigate('contact')}
                className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-white border border-[#f9bf8f]/70 hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <span>Contact Support</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      )}

      {/* Tab 2: Profile & Account Details */}
      {activeTab === 'profile' && (
        <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-6 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-[#f9bf8f]/40 mb-5">
            <div>
              <h3 className="text-base font-bold text-[#34222e]">Personal & Account Details</h3>
              <p className="text-xs text-[#7a6274] mt-0.5">Manage your personal credentials, contact info, and role.</p>
            </div>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#f9bf8f]/70 hover:bg-[#fee9d7]/50 text-[#34222e] text-xs font-semibold cursor-pointer transition shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#7a6274]" />
                <span>Edit Details</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-[#7a6274] hover:text-[#34222e] font-semibold cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#fee9d7]/30 rounded-2xl border border-[#f9bf8f]/40">
                <span className="text-[11px] text-[#7a6274] block mb-1">Full Legal Name</span>
                <span className="font-bold text-[#34222e] text-sm">{user.fullName}</span>
              </div>

              <div className="p-4 bg-[#fee9d7]/30 rounded-2xl border border-[#f9bf8f]/40">
                <span className="text-[11px] text-[#7a6274] block mb-1">Primary Email Address</span>
                <span className="font-mono font-semibold text-[#34222e]">{user.email}</span>
              </div>

              <div className="p-4 bg-[#fee9d7]/30 rounded-2xl border border-[#f9bf8f]/40">
                <span className="text-[11px] text-[#7a6274] block mb-1">Mobile Phone Number</span>
                <span className="font-mono font-semibold text-[#34222e]">{user.phone}</span>
              </div>

              <div className="p-4 bg-[#fee9d7]/30 rounded-2xl border border-[#f9bf8f]/40">
                <span className="text-[11px] text-[#7a6274] block mb-1">Account Category</span>
                <span className="font-bold text-[#34222e] capitalize">
                  {user.accountType === 'business' ? 'B2B Enterprise / Institutional Lab' : 'Maker / Individual Pro'}
                </span>
              </div>

              {user.companyName && (
                <div className="p-4 bg-[#fee9d7]/30 rounded-2xl border border-[#f9bf8f]/40 sm:col-span-2">
                  <span className="text-[11px] text-[#7a6274] block mb-1">Company / Lab / Institute</span>
                  <span className="font-bold text-[#34222e] text-sm">{user.companyName}</span>
                </div>
              )}

              {user.designation && (
                <div className="p-4 bg-[#fee9d7]/30 rounded-2xl border border-[#f9bf8f]/40 sm:col-span-2">
                  <span className="text-[11px] text-[#7a6274] block mb-1">Role / Designation</span>
                  <span className="font-semibold text-[#34222e]">{user.designation}</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#34222e] font-bold mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#f9bf8f]/70 rounded-xl focus:border-[#0c831f] outline-none text-[#34222e] font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[#34222e] font-bold mb-1.5">Mobile Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#f9bf8f]/70 rounded-xl focus:border-[#0c831f] outline-none text-[#34222e] font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[#34222e] font-bold mb-1.5">Company / Lab Name (Optional)</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Robotics Lab"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#f9bf8f]/70 rounded-xl focus:border-[#0c831f] outline-none text-[#34222e]"
                  />
                </div>

                <div>
                  <label className="block text-[#34222e] font-bold mb-1.5">Role / Designation (Optional)</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Hardware Engineer"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#f9bf8f]/70 rounded-xl focus:border-[#0c831f] outline-none text-[#34222e]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-[#f9bf8f]/70 rounded-xl text-[#7a6274] hover:text-[#34222e] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0c831f] hover:bg-[#0a6e1a] text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
                >
                  Save Profile
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Tab 3: Saved Delivery Addresses */}
      {activeTab === 'addresses' && (
        <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-6 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-[#f9bf8f]/40 mb-5">
            <div>
              <h3 className="text-base font-bold text-[#34222e]">Saved Delivery Addresses</h3>
              <p className="text-xs text-[#7a6274] mt-0.5">Pre-saved addresses for fast 1-click checkout and delivery.</p>
            </div>
            {!isAddingAddress && (
              <button
                type="button"
                onClick={() => setIsAddingAddress(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0c831f] hover:bg-[#0a6e1a] text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Address</span>
              </button>
            )}
          </div>

          {/* Add Address Form */}
          {isAddingAddress && (
            <form onSubmit={handleAddAddress} className="mb-6 p-5 bg-[#fee9d7]/30 border border-[#f9bf8f]/60 rounded-2xl space-y-3.5 text-xs animate-in fade-in duration-150">
              <h4 className="font-bold text-[#34222e] text-sm">Add New Address</h4>
              
              <div>
                <label className="block text-[#34222e] font-bold mb-1">Street Address / House / Plot / Lab</label>
                <input
                  type="text"
                  value={newAddrLine1}
                  onChange={(e) => setNewAddrLine1(e.target.value)}
                  placeholder="e.g. Lab 3, Department of Robotics, IIT Kanpur Campus"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#f9bf8f]/70 rounded-xl outline-none focus:border-[#0c831f] text-[#34222e]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#34222e] font-bold mb-1">City</label>
                  <input
                    type="text"
                    value={newAddrCity}
                    onChange={(e) => setNewAddrCity(e.target.value)}
                    placeholder="Kanpur"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#f9bf8f]/70 rounded-xl outline-none focus:border-[#0c831f] text-[#34222e]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#34222e] font-bold mb-1">State</label>
                  <select
                    value={newAddrState}
                    onChange={(e) => setNewAddrState(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#f9bf8f]/70 rounded-xl outline-none focus:border-[#0c831f] text-[#34222e]"
                  >
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Haryana">Haryana</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#34222e] font-bold mb-1">PIN Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={newAddrPincode}
                    onChange={(e) => setNewAddrPincode(e.target.value)}
                    placeholder="208016"
                    className="w-full px-3.5 py-2.5 font-mono bg-white border border-[#f9bf8f]/70 rounded-xl outline-none focus:border-[#0c831f] text-[#34222e]"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4 pt-1">
                <label className="text-[#34222e] font-bold">Address Type:</label>
                <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="addressType"
                    checked={newAddrType === 'business'}
                    onChange={() => setNewAddrType('business')}
                    className="accent-[#0c831f]"
                  />
                  <span>Business / Lab</span>
                </label>
                <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="addressType"
                    checked={newAddrType === 'residential'}
                    onChange={() => setNewAddrType('residential')}
                    className="accent-[#0c831f]"
                  />
                  <span>Home / Residential</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingAddress(false)}
                  className="px-4 py-2 border border-[#f9bf8f]/70 rounded-xl text-[#7a6274] hover:text-[#34222e] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0c831f] hover:bg-[#0a6e1a] text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
                >
                  Save Address
                </button>
              </div>
            </form>
          )}

          {/* List of Saved Addresses */}
          {user.addresses.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#f9bf8f]/60 rounded-2xl bg-[#fee9d7]/20">
              <MapPin className="w-8 h-8 text-[#7a6274] mx-auto mb-2 opacity-60" />
              <p className="text-xs font-semibold text-[#34222e]">No addresses saved yet.</p>
              <p className="text-[11px] text-[#7a6274] mt-0.5">Add your lab, office, or home location for 1-click ordering.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {user.addresses.map((addr) => (
                <div 
                  key={addr.id}
                  className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                    addr.isDefault
                      ? 'border-[#0c831f] bg-[#f2fcf4]/40 ring-1 ring-[#0c831f]/20 shadow-xs'
                      : 'border-[#f9bf8f]/60 bg-white hover:border-[#f9bf8f]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-[#34222e]">{addr.fullName}</span>
                        <span className="text-[10px] bg-[#fee9d7] text-[#34222e] px-2 py-0.5 rounded-full font-bold">
                          {addr.type === 'business' ? '🏢 Lab / Business' : '🏠 Home'}
                        </span>
                      </div>
                      {addr.isDefault && (
                        <span className="text-[10px] font-bold text-[#0c831f] bg-[#f2fcf4] border border-[#0c831f]/30 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>

                    {addr.companyName && (
                      <p className="text-[11px] font-semibold text-[#7a6274]">{addr.companyName}</p>
                    )}
                    <p className="text-xs text-[#34222e] mt-1 leading-relaxed">
                      {addr.addressLine1}
                      {addr.addressLine2 && `, ${addr.addressLine2}`}
                    </p>
                    <p className="text-xs text-[#7a6274] font-medium mt-0.5">
                      {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                    <p className="text-[11px] text-[#7a6274] font-mono mt-1">Phone: {addr.phone}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f9bf8f]/40 flex items-center justify-between text-xs">
                    {!addr.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(addr.id)}
                        className="text-[#0c831f] hover:underline font-bold cursor-pointer"
                      >
                        Set as Default
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#0c831f] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Active Default
                      </span>
                    )}
                    {user.addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-[#e2434b] hover:underline font-semibold cursor-pointer ml-auto"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: GST & Business Invoicing */}
      {activeTab === 'gst' && (
        <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-6 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-[#f9bf8f]/40 mb-5">
            <div>
              <h3 className="text-base font-bold text-[#34222e]">Goods & Services Tax (GST) Invoicing</h3>
              <p className="text-xs text-[#7a6274] mt-0.5">
                Compliant e-invoices with Government IRN hash for 18% Input Tax Credit (ITC).
              </p>
            </div>
            {user.gstDetails?.verified && (
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-[#f2fcf4] text-[#0c831f] border border-[#0c831f]/30 rounded-xl text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-[#0c831f]" />
                <span>GSTIN on this profile</span>
              </div>
            )}
          </div>

          {user.gstDetails?.gstin ? (
            <div className="space-y-4">
              <div className="p-4 bg-[#fee9d7]/30 rounded-2xl border border-[#f9bf8f]/60 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] text-[#7a6274] block mb-0.5">GSTIN Number</span>
                    <span className="text-sm font-mono font-bold text-[#34222e]">{user.gstDetails.gstin}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#7a6274] block mb-0.5">Permanent Account Number (PAN)</span>
                    <span className="text-sm font-mono font-bold text-[#34222e]">
                      {user.gstDetails.pan || user.gstDetails.gstin.substring(2, 12)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#7a6274] block mb-0.5">Registered Legal Entity</span>
                    <span className="font-bold text-[#34222e]">{user.gstDetails.legalName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#7a6274] block mb-0.5">Jurisdiction State Code</span>
                    <span className="font-semibold text-[#34222e]">
                      State Code {user.gstDetails.stateCode}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#f2fcf4] border border-[#0c831f]/30 rounded-2xl text-[#0c831f] flex items-start space-x-3 text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#0c831f] shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold">GSTIN saved on this profile only</h5>
                  <p className="text-[#34222e]/80 mt-0.5 leading-relaxed">
                    Listed prices already include GST. Spaceborn does not issue a GST tax invoice, so this number is not printed on a receipt and cannot be used for input tax credit.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-[#fee9d7]/20 rounded-2xl border border-dashed border-[#f9bf8f]/70 text-center space-y-3">
              <Building2 className="w-8 h-8 text-[#7a6274] mx-auto opacity-70" />
              <div>
                <h4 className="text-xs font-bold text-[#34222e]">No GSTIN Linked</h4>
                <p className="text-[11px] text-[#7a6274] max-w-md mx-auto mt-1 leading-relaxed">
                  A GSTIN saved here stays on your profile. Spaceborn does not turn it into a tax invoice.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
