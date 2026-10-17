'use client';
import React from 'react';
import { useDraft } from '@spaceborn/web-core/use-draft';
import {
  Mail,
  MapPin,
  Send,
  Headphones,
  Store,
  Package
} from 'lucide-react';
import { AppView } from '../types';

interface ContactViewProps {
  onNavigate: (view: AppView) => void;
}

const SUPPORT_EMAIL = 'support@spaceborn.in';

const TOPICS: Record<string, string> = {
  order: 'An order I placed',
  part: 'A part or its datasheet',
  fabrication: '3D printing or CNC job',
  seller: 'Selling on Spaceborn',
  other: 'Something else',
};

export const ContactView: React.FC<ContactViewProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useDraft('contact:form', {
    name: '',
    topic: 'order',
    orderNumber: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `${TOPICS[formData.topic]}${formData.orderNumber ? ` (${formData.orderNumber})` : ''}`;
    const body = `${formData.message}\n\n${formData.name}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-[#f9bf8f]/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f2fcf4] border border-[#0c831f]/20 text-[#0c831f] text-xs font-bold mb-3">
              <Headphones className="w-3.5 h-3.5" />
              <span>Help & contact</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#34222e] tracking-tight">Get in touch</h1>
            <p className="text-[#7a6274] text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Questions about an order, a part, a fabrication job or selling on Spaceborn. Write to us and include your order number if you have one.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 shrink-0 border border-[#f9bf8f]/60 space-y-1.5 shadow-xs">
            <div className="text-sm sm:text-base font-bold text-[#34222e] flex items-center space-x-1.5">
              <Mail className="w-4 h-4 text-[#e2434b]" />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-[#0c831f]">{SUPPORT_EMAIL}</a>
            </div>
            <p className="text-[#7a6274] text-[11px]">We reply by email.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

          <div className="lg:col-span-2 bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-[#f9bf8f]/60 shadow-xs">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div className="border-b border-[#f9bf8f]/40 pb-3 sm:pb-4">
                <h3 className="text-base sm:text-lg font-bold text-[#34222e]">Write to support</h3>
                <p className="text-[#7a6274] text-xs mt-0.5">This opens your email app with the message filled in.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#34222e] mb-1">Your name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#34222e] mb-1">Topic *</label>
                  <select
                    value={formData.topic}
                    onChange={e => setFormData({ ...formData, topic: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] transition cursor-pointer"
                  >
                    {Object.entries(TOPICS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#34222e] mb-1">Order number or SKU (optional)</label>
                <input
                  type="text"
                  value={formData.orderNumber}
                  onChange={e => setFormData({ ...formData, orderNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#34222e] mb-1">Message *</label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#f9bf8f]/70 bg-white text-[#34222e] outline-none focus:border-[#0c831f] focus:ring-2 focus:ring-[#0c831f]/10 transition"
                />
              </div>

              <button
                type="submit"
                className="bg-[#0c831f] hover:bg-[#0a6e1a] text-white px-6 sm:px-7 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Open in email</span>
              </button>
            </form>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-3 text-[#34222e]">
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#0c831f]" />
                <span>About an order</span>
              </h4>
              <p className="text-[#7a6274] text-xs leading-relaxed">
                My Orders shows the shop that is sending each order, its status and the delivery code. You can cancel there until the shop accepts the order.
              </p>
              <button onClick={() => onNavigate('orders')} className="text-xs font-bold text-[#0c831f] hover:underline cursor-pointer">
                Go to My Orders →
              </button>
            </div>

            <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-3 text-[#34222e]">
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <Store className="w-4 h-4 text-[#e2434b]" />
                <span>Own an electronics shop?</span>
              </h4>
              <p className="text-[#7a6274] text-xs leading-relaxed">
                Register on the seller hub. Once our team approves your shop, your stock shows up for customers near you.
              </p>
              <button onClick={() => onNavigate('vendor')} className="text-xs font-bold text-[#0c831f] hover:underline cursor-pointer">
                Become a seller →
              </button>
            </div>

            <div className="bg-[#fffbf7] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#f9bf8f]/60 shadow-xs space-y-2 text-[#34222e]">
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#e2434b]" />
                <span>Where we deliver</span>
              </h4>
              <p className="text-[#7a6274] text-xs leading-relaxed">
                Kanpur, Bengaluru, Chennai and Pune, within each partner shop&apos;s delivery radius. Set your location in the header to see what is in stock near you.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
