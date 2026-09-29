'use client';
import React, { useState } from 'react';
import { 
  PhoneCall, 
  Mail, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  MessageSquare, 
  FileQuestion, 
  Cpu, 
  ShieldCheck 
} from 'lucide-react';
import { AppView } from '../types';

interface ContactViewProps {
  onNavigate: (view: AppView) => void;
}

export const ContactView: React.FC<ContactViewProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    inquiryType: 'technical_spec',
    orderNumber: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [callbackRequested, setCallbackRequested] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleCallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (callbackPhone) {
      setCallbackRequested(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Title Header */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#6366f1] text-xs font-bold mb-3">
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Spaceborn Technical Support & Engineering Desk</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Direct Lab Access & Inquiries</h1>
            <p className="text-slate-600 text-sm mt-1">
              Have questions regarding pinouts, torque curves, custom PCB manufacturing, or bulk quotes? Our application engineers are available 6 days a week.
            </p>
          </div>

          <div className="bg-slate-900 text-white rounded-xl p-5 shrink-0 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Engineers Live on Technical Desk</span>
            </div>
            <div className="text-lg font-black tracking-tight text-white">+91 080 4912 8800</div>
            <p className="text-slate-400 text-[11px]">Mon - Sat: 9:30 AM – 6:30 PM IST</p>
          </div>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Direct Inquiries Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs">
            {submitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Inquiry Ticket Dispatched</h3>
                <p className="text-slate-600 text-sm max-w-md mx-auto">
                  Thank you, <strong className="text-slate-900">{formData.name}</strong>. A Spaceborn hardware application engineer will review your specifications and respond to <strong className="text-slate-900">{formData.email}</strong> within 3 business hours.
                </p>
                <div className="pt-4">
                  <button 
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({
                        name: '',
                        email: '',
                        phone: '',
                        company: '',
                        inquiryType: 'technical_spec',
                        orderNumber: '',
                        message: ''
                      });
                    }}
                    className="bg-[#6366f1] hover:bg-[#d44000] text-white px-6 py-2.5 rounded-lg text-sm font-bold transition cursor-pointer"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">Submit Technical or Institutional Inquiry</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Please provide component SKUs or order IDs where applicable.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Vikram Joshi"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Work / Institutional Email *</label>
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="engineer@company.com"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile / WhatsApp Number</label>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98000 00000"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Organization / Lab / College</label>
                    <input 
                      type="text" 
                      value={formData.company}
                      onChange={e => setFormData({ ...formData, company: e.target.value })}
                      placeholder="e.g. Apex Robotics / IIT Labs"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry Domain *</label>
                    <select 
                      value={formData.inquiryType}
                      onChange={e => setFormData({ ...formData, inquiryType: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] bg-white transition cursor-pointer"
                    >
                      <option value="technical_spec">Datasheet, Pinouts & Firmware Help</option>
                      <option value="b2b_quote">Institutional Bulk Quote / Purchase Order</option>
                      <option value="fabrication">Custom PCB / Wire Harness Prototyping</option>
                      <option value="order_tracking">Order Telemetry & BlueDart Transit</option>
                      <option value="gst_invoice">GST E-Invoice & B2B Tax Credit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reference Order / SKU (Optional)</label>
                    <input 
                      type="text" 
                      value={formData.orderNumber}
                      onChange={e => setFormData({ ...formData, orderNumber: e.target.value })}
                      placeholder="e.g. SPBN-892411 or MOT-N20"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] transition font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry Details *</label>
                  <textarea 
                    rows={4}
                    required
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your technical requirements, voltage ratings, quantity requirements, or issues..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[#6366f1] transition"
                  />
                </div>

                <button 
                  type="submit"
                  className="bg-[#6366f1] hover:bg-[#d44000] text-white px-7 py-3 rounded-lg text-sm font-bold flex items-center space-x-2 transition shadow-md shadow-orange-500/20 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Ticket to Engineering Desk</span>
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Physical Addresses & Instant Callback */}
          <div className="space-y-6">
            
            {/* Quick 10-Min Callback Card */}
            <div className="bg-white rounded-2xl p-6 text-white border border-slate-800 space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                <span>Instant 15-Min Engineer Callback</span>
              </div>
              <h4 className="font-bold text-base text-white">Need immediate component sizing assistance?</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Enter your phone number. Our senior electrical engineer will call you right away with pinout and voltage guidance.
              </p>

              {callbackRequested ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-300 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Callback queued! Engineer will dial {callbackPhone} shortly.</span>
                </div>
              ) : (
                <form onSubmit={handleCallbackSubmit} className="space-y-2">
                  <div className="flex rounded-lg overflow-hidden border border-slate-700">
                    <input 
                      type="tel"
                      required
                      value={callbackPhone}
                      onChange={e => setCallbackPhone(e.target.value)}
                      placeholder="+91 98450 00000"
                      className="w-full px-3 py-2 text-xs bg-slate-800 text-white outline-none placeholder:text-slate-500 font-mono"
                    />
                    <button 
                      type="submit"
                      className="bg-[#6366f1] hover:bg-[#d44000] text-white px-4 text-xs font-bold transition shrink-0 cursor-pointer"
                    >
                      Call Me
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Available 9:30 AM – 6:30 PM IST Mon-Sat</span>
                </form>
              )}
            </div>

            {/* Hub Contacts */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
              <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Lab & Hub Locations</h4>

              <div className="space-y-4 text-xs">
                <div className="border-l-2 border-[#6366f1] pl-3 space-y-1">
                  <div className="font-bold text-slate-900">Spaceborn Aerospace & Hardware R&D Hub</div>
                  <p className="text-slate-600">Plot 18, Phase 2, Electronic City, Bengaluru 560100</p>
                  <p className="text-slate-500">Email: blr.lab@spaceborn.in</p>
                </div>

                <div className="border-l-2 border-blue-500 pl-3 space-y-1">
                  <div className="font-bold text-slate-900">Spaceborn Fulfillment & QC Laboratory</div>
                  <p className="text-slate-600">S. No. 42/1, Chakan Industrial Tech Zone, Pune 410501</p>
                  <p className="text-slate-500">Email: pune.hub@spaceborn.in</p>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-1">
                  <div className="font-bold text-slate-900">GST Registration</div>
                  <p className="text-slate-500 font-mono">Karnataka: 29AABCS9482Q1Z7</p>
                  <p className="text-slate-500 font-mono">Maharashtra: 27AABCS9482Q1Z5</p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
