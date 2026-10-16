'use client';
import React, { useState } from 'react';
import { 
  Mail, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  Headphones
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Title Header */}
        <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-[#f9bf8f]/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f2fcf4] border border-[#0c831f]/20 text-[#0c831f] text-xs font-bold mb-3">
              <Headphones className="w-3.5 h-3.5" />
              <span>Spaceborn Technical Support & Engineering Desk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#34222e] tracking-tight">Direct Lab Access & Inquiries</h1>
            <p className="text-[#7a6274] text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Have questions regarding pinouts, torque curves, custom PCB manufacturing, or bulk quotes? Our application engineers are available 6 days a week.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 shrink-0 border border-[#f9bf8f]/60 space-y-1.5 shadow-xs">
            <div className="flex items-center space-x-2 text-xs text-[#0c831f] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#0c831f] animate-pulse" />
              <span>Technical Desk Active</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-[#34222e] flex items-center space-x-1.5">
              <Mail className="w-4 h-4 text-[#e2434b]" />
              <span>support@spaceborn.in</span>
            </div>
            <p className="text-[#7a6274] text-[11px]">Mon – Sat: 9:30 AM – 6:30 PM IST</p>
          </div>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/* Left Column: Direct Inquiries Form */}
          <div className="lg:col-span-2 bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-[#f9bf8f]/60 shadow-xs">
            {submitted ? (
              <div className="text-center py-10 sm:py-12 space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#fee9d7] text-[#e2434b] flex items-center justify-center mx-auto border border-[#f9bf8f]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#34222e]">Direct Inquiry Received</h3>
                <p className="text-[#7a6274] text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                  Thank you! For fastest response, you can also write directly to our engineering desk at{' '}
                  <a href="mailto:blr.lab@spaceborn.in" className="font-semibold text-[#0c831f] underline">
                    blr.lab@spaceborn.in
                  </a>{' '}
                  referencing your order or part requirements.
                </p>
                <div className="pt-2">
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
                    className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-5 sm:px-6 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                <div className="border-b border-[#f9bf8f]/40 pb-3 sm:pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#34222e]">Submit Technical or Institutional Inquiry</h3>
                  <p className="text-[#7a6274] text-xs mt-0.5">Please provide component SKUs or order IDs where applicable.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#34222e] mb-1">Full Name *</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Vikram Joshi"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#34222e] mb-1">Work / Institutional Email *</label>
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="engineer@company.com"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#34222e] mb-1">Mobile / WhatsApp Number</label>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98000 00000"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#34222e] mb-1">Organization / Lab / College</label>
                    <input 
                      type="text" 
                      value={formData.company}
                      onChange={e => setFormData({ ...formData, company: e.target.value })}
                      placeholder="e.g. Apex Robotics / IIT Labs"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#34222e] mb-1">Inquiry Domain *</label>
                    <select 
                      value={formData.inquiryType}
                      onChange={e => setFormData({ ...formData, inquiryType: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] transition cursor-pointer"
                    >
                      <option value="technical_spec">Datasheet, Pinouts & Firmware Help</option>
                      <option value="b2b_quote">Institutional Bulk Quote / Purchase Order</option>
                      <option value="fabrication">Custom PCB / Wire Harness Prototyping</option>
                      <option value="order_tracking">Order Telemetry & BlueDart Transit</option>
                      <option value="gst_invoice">GST E-Invoice & B2B Tax Credit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#34222e] mb-1">Reference Order / SKU (Optional)</label>
                    <input 
                      type="text" 
                      value={formData.orderNumber}
                      onChange={e => setFormData({ ...formData, orderNumber: e.target.value })}
                      placeholder="e.g. SPBN-892411 or MOT-N20"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] transition font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#34222e] mb-1">Inquiry Details *</label>
                  <textarea 
                    rows={4}
                    required
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your technical requirements, voltage ratings, quantity requirements, or issues..."
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10 transition"
                  />
                </div>

                <button 
                  type="submit"
                  className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-6 sm:px-7 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Ticket to Engineering Desk</span>
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Direct Channels & Hub Locations */}
          <div className="space-y-4 sm:space-y-6">
            
            {/* Direct Support Card */}
            <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-3.5 text-[#34222e]">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#0c831f] uppercase tracking-wider">
                <Headphones className="w-4 h-4 text-[#0c831f]" />
                <span>Engineering & Sourcing Desk</span>
              </div>
              <h4 className="font-bold text-sm sm:text-base text-[#34222e]">Direct Technical Assistance</h4>
              <p className="text-[#7a6274] text-xs leading-relaxed">
                For component sizing, custom CNC tolerances, or bulk procurement inquiries, reach our engineering team directly via email or the inquiry form.
              </p>

              <div className="space-y-2 pt-1 text-xs">
                <div className="p-3 bg-white rounded-xl border border-[#f9bf8f]/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7a6274] block">General & Technical Support</span>
                    <a href="mailto:support@spaceborn.in" className="font-bold text-[#34222e] hover:text-[#0c831f] transition">
                      support@spaceborn.in
                    </a>
                  </div>
                  <span className="text-[10px] font-semibold text-[#0c831f] bg-[#f2fcf4] px-2 py-0.5 rounded-full border border-[#0c831f]/20">
                    &lt; 2hr reply
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#f9bf8f]/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7a6274] block">Institutional & B2B Orders</span>
                    <a href="mailto:b2b@spaceborn.in" className="font-bold text-[#34222e] hover:text-[#0c831f] transition">
                      b2b@spaceborn.in
                    </a>
                  </div>
                  <span className="text-[10px] font-semibold text-[#34222e] bg-[#fee9d7] px-2 py-0.5 rounded-full border border-[#f9bf8f]">
                    Same-day quote
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 text-[11px] text-[#7a6274] pt-1">
                <Clock className="w-3.5 h-3.5 text-[#7a6274]" />
                <span>Desk Active: Mon – Sat, 9:30 AM – 6:30 PM IST</span>
              </div>
            </div>

            {/* Hub Contacts */}
            <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-4 text-[#34222e]">
              <h4 className="font-bold text-[#34222e] text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#e2434b]" />
                <span>Lab & Hub Locations</span>
              </h4>

              <div className="space-y-3.5 text-xs">
                <div className="border-l-2 border-[#e2434b] pl-3 space-y-1">
                  <div className="font-bold text-[#34222e] text-xs sm:text-sm">Spaceborn Aerospace & Hardware R&D Hub</div>
                  <p className="text-[#7a6274]">Plot 18, Phase 2, Electronic City, Bengaluru 560100</p>
                  <p className="text-[#0c831f] font-semibold">Email: blr.lab@spaceborn.in</p>
                </div>

                <div className="border-l-2 border-[#0c831f] pl-3 space-y-1">
                  <div className="font-bold text-[#34222e] text-xs sm:text-sm">Spaceborn Fulfillment & QC Laboratory</div>
                  <p className="text-[#7a6274]">S. No. 42/1, Chakan Industrial Tech Zone, Pune 410501</p>
                  <p className="text-[#0c831f] font-semibold">Email: pune.hub@spaceborn.in</p>
                </div>

                <div className="border-t border-[#f9bf8f]/40 pt-3 space-y-1">
                  <div className="font-bold text-[#34222e] text-xs">GST Registration</div>
                  <p className="text-[#7a6274] font-mono text-[11px]">Karnataka: 29AABCS9482Q1Z7</p>
                  <p className="text-[#7a6274] font-mono text-[11px]">Maharashtra: 27AABCS9482Q1Z5</p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
