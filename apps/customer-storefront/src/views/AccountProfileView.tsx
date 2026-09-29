'use client';
import React, { useState } from 'react';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  FileCheck2, 
  LogOut, 
  ShieldCheck, 
  Package, 
  Award, 
  Sparkles, 
  Edit3, 
  CheckCircle2, 
  Plus, 
  ExternalLink,
  ChevronRight
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
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'gst' | 'maker-club'>('profile');
  
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

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...user,
      fullName,
      phone,
      companyName: companyName || undefined,
      designation: designation || undefined
    };
    onUpdateProfile(updated);
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrLine1 || !newAddrCity || !newAddrPincode) return;

    const newAddress: Address = {
      id: `addr-${Date.now()}`,
      fullName: user.fullName,
      companyName: user.companyName,
      email: user.email,
      phone: user.phone,
      addressLine1: newAddrLine1,
      city: newAddrCity,
      state: newAddrState,
      pincode: newAddrPincode,
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
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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
  };

  const handleDeleteAddress = (addrId: string) => {
    onUpdateProfile({
      ...user,
      addresses: user.addresses.filter(a => a.id !== addrId)
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
      
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-xs text-slate-500 mb-6">
        <button onClick={() => onNavigate('home')} className="hover:text-slate-800 cursor-pointer">Home</button>
        <span>/</span>
        <span className="font-semibold text-slate-800">My Spaceborn Account</span>
      </div>

      {savedSuccess && (
        <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Profile changes successfully synced across Spaceborn session!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left User Card & Quick Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Main User Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#ff7a45] text-white flex items-center justify-center font-black text-xl shadow-md shadow-orange-500/20">
                  {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">{user.fullName}</h3>
                  <p className="text-xs text-slate-500">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {user.accountType === 'business' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Building2 className="w-3 h-3 mr-1" />
                        B2B Enterprise
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Maker Pro
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">Since {user.joinedDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {user.companyName && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Organization:</span>
                  <span className="font-semibold text-slate-800 text-right">{user.companyName}</span>
                </div>
                {user.designation && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Role:</span>
                    <span className="font-semibold text-slate-800">{user.designation}</span>
                  </div>
                )}
                {user.gstDetails?.gstin && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">GSTIN:</span>
                    <span className="font-mono font-bold text-emerald-700">{user.gstDetails.gstin}</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Action Navigation */}
            <div className="mt-5 space-y-1 pt-4 border-t border-slate-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 flex items-center justify-between text-slate-700 hover:text-[#6366f1] transition cursor-pointer"
              >
                <span className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span>My Orders & Live Telemetry</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigate('orders');
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 flex items-center justify-between text-slate-700 hover:text-[#6366f1] transition cursor-pointer"
              >
                <span className="flex items-center space-x-2">
                  <FileCheck2 className="w-4 h-4 text-slate-400" />
                  <span>GST Invoices Archive</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Sign Out Button */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full py-2 px-3 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out from Workstation</span>
              </button>
            </div>
          </div>

          {/* Maker Tier Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-xs">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 mb-1">
              <Award className="w-4 h-4" />
              <span>SPACEBORN MAKER CLUB TIER</span>
            </div>
            <h4 className="text-base font-bold text-white mb-2">{user.makerLevel || 'Robotics Engineer'}</h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Qualify for additional 5% bulk rebate coupons and prioritized component bench QC testing.
            </p>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
              <div className="bg-[#6366f1] h-full w-3/4 rounded-full" />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Next Milestone: Enterprise VIP</span>
              <span>₹4,860 / ₹10,000 spend</span>
            </div>
          </div>

        </div>

        {/* Right Main Content Tabs Column */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          
          {/* Tabs Navigation */}
          <div className="flex border-b border-slate-200 px-6 pt-4 gap-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`pb-3 border-b-2 transition cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-[#6366f1] text-[#6366f1]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Account Information
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('addresses')}
              className={`pb-3 border-b-2 transition cursor-pointer ${
                activeTab === 'addresses'
                  ? 'border-[#6366f1] text-[#6366f1]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Saved Delivery Addresses ({user.addresses.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gst')}
              className={`pb-3 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'gst'
                  ? 'border-[#6366f1] text-[#6366f1]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>GST & Tax Certification</span>
              {user.gstDetails?.verified && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>

          <div className="p-6">

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Personal & Institutional Credentials</h4>
                    <p className="text-xs text-slate-500">Manage contact information and shipping notification preferences.</p>
                  </div>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[11px] text-slate-400 block mb-1">Full Legal Name</span>
                      <span className="font-bold text-slate-800 text-sm">{user.fullName}</span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[11px] text-slate-400 block mb-1">Primary Email Address</span>
                      <span className="font-mono font-semibold text-slate-800">{user.email}</span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[11px] text-slate-400 block mb-1">Phone Number</span>
                      <span className="font-mono font-semibold text-slate-800">{user.phone}</span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[11px] text-slate-400 block mb-1">Account Category</span>
                      <span className="font-bold text-slate-800 capitalize">
                        {user.accountType === 'business' ? 'B2B Enterprise / Institutional Lab' : 'Maker / Individual Pro'}
                      </span>
                    </div>

                    {user.companyName && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 sm:col-span-2">
                        <span className="text-[11px] text-slate-400 block mb-1">Company / University Lab Name</span>
                        <span className="font-bold text-slate-800 text-sm">{user.companyName}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Full Legal Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-[#6366f1] outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Mobile Phone Number</label>
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-[#6366f1] outline-none font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Company / Institution Name</label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-[#6366f1] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Designation / Role</label>
                        <input
                          type="text"
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-[#6366f1] outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#6366f1] text-white rounded-lg font-bold hover:bg-[#d4430e] shadow-xs cursor-pointer"
                      >
                        Save Profile Changes
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Addresses Tab */}
            {activeTab === 'addresses' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Delivery & Lab Drop Locations</h4>
                    <p className="text-xs text-slate-500">Pre-saved addresses for 1-click expedited checkout.</p>
                  </div>
                  {!isAddingAddress && (
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(true)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add New Address</span>
                    </button>
                  )}
                </div>

                {/* Add Address Form */}
                {isAddingAddress && (
                  <form onSubmit={handleAddAddress} className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                    <h5 className="font-bold text-slate-900">Enter Shipping Address</h5>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Street Address / Tech Park / Plot</label>
                      <input
                        type="text"
                        value={newAddrLine1}
                        onChange={(e) => setNewAddrLine1(e.target.value)}
                        placeholder="e.g. Building 4B, Electronic City Phase 2"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg outline-none"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">City</label>
                        <input
                          type="text"
                          value={newAddrCity}
                          onChange={(e) => setNewAddrCity(e.target.value)}
                          placeholder="Bengaluru"
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">State</label>
                        <select
                          value={newAddrState}
                          onChange={(e) => setNewAddrState(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg outline-none"
                        >
                          <option value="Karnataka">Karnataka</option>
                          <option value="Maharashtra">Maharashtra</option>
                          <option value="Delhi">Delhi</option>
                          <option value="Tamil Nadu">Tamil Nadu</option>
                          <option value="Telangana">Telangana</option>
                          <option value="Gujarat">Gujarat</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Pincode</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={newAddrPincode}
                          onChange={(e) => setNewAddrPincode(e.target.value)}
                          placeholder="560100"
                          className="w-full px-3 py-1.5 font-mono bg-white border border-slate-300 rounded-lg outline-none"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingAddress(false)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-[#6366f1] text-white rounded-lg font-bold hover:bg-[#d4430e]"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                )}

                {/* List of Saved Addresses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {user.addresses.map((addr) => (
                    <div 
                      key={addr.id}
                      className={`p-4 rounded-xl border transition relative ${
                        addr.isDefault
                          ? 'border-[#6366f1] bg-orange-50/20 shadow-xs ring-1 ring-orange-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">{addr.fullName}</span>
                          {addr.type === 'business' ? (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                              Business
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                              Residential
                            </span>
                          )}
                        </div>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold text-[#6366f1] bg-orange-100 px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>

                      {addr.companyName && (
                        <p className="text-[11px] font-semibold text-slate-700">{addr.companyName}</p>
                      )}
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {addr.addressLine1}
                        {addr.addressLine2 && `, ${addr.addressLine2}`}
                      </p>
                      <p className="text-xs text-slate-600 font-medium">
                        {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-1">Phone: {addr.phone}</p>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultAddress(addr.id)}
                            className="text-[#0051d5] hover:underline font-semibold cursor-pointer"
                          >
                            Set as Default
                          </button>
                        )}
                        {user.addresses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="text-red-500 hover:underline cursor-pointer ml-auto"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GST Tab */}
            {activeTab === 'gst' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Goods & Services Tax (GST) Profile</h4>
                    <p className="text-xs text-slate-500">Ensure compliant e-invoicing and claim up to 18% Input Tax Credit on electronic parts.</p>
                  </div>
                  {user.gstDetails?.verified && (
                    <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Verified GSTIN</span>
                    </div>
                  )}
                </div>

                {user.gstDetails?.gstin ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">GSTIN Identification Number</span>
                        <span className="text-sm font-mono font-bold text-slate-900">{user.gstDetails.gstin}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">Permanent Account Number (PAN)</span>
                        <span className="text-sm font-mono font-bold text-slate-900">{user.gstDetails.pan || user.gstDetails.gstin.substring(2, 12)}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">Registered Legal Entity Name</span>
                        <span className="font-bold text-slate-800">{user.gstDetails.legalName}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">Jurisdiction State Code</span>
                        <span className="font-semibold text-slate-800">
                          State Code {user.gstDetails.stateCode} ({user.gstDetails.stateCode === '29' ? 'Karnataka' : user.gstDetails.stateCode === '27' ? 'Maharashtra' : 'Inter-State'})
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h6 className="font-bold">Input Tax Credit (ITC) Active</h6>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Every order placed will be automatically issued with an official GST Tax Invoice containing Government IRN hash and verifiable signed QR code.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
                    <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">No GSTIN Registered</h5>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
                        If you represent a registered business, university or research lab, link your 15-digit GSTIN to unlock 18% tax credit and volume invoicing.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateProfile({
                          ...user,
                          accountType: 'business',
                          companyName: user.companyName || 'Robotics Lab',
                          gstDetails: {
                            enabled: true,
                            legalName: user.companyName || 'Apex Robotics Labs LLP',
                            gstin: '29AABCA9482Q1Z7',
                            pan: 'AABCA9482Q',
                            stateCode: '29',
                            verified: true
                          }
                        });
                        setSavedSuccess(true);
                      }}
                      className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-xs font-bold hover:bg-[#d4430e] cursor-pointer"
                    >
                      Attach Verified Sample GSTIN (29AABCA9482Q1Z7)
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
