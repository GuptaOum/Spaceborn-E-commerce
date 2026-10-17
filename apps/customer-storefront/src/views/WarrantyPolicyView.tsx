'use client';
import React from 'react';
import {
  ShieldCheck,
  XCircle,
  RotateCcw,
  KeyRound,
  Mail,
  Lock
} from 'lucide-react';
import { AppView } from '../types';

interface WarrantyPolicyViewProps {
  onNavigate: (view: AppView) => void;
}

const SECTIONS = [
  {
    icon: XCircle,
    tone: 'bg-rose-50 text-rose-600',
    title: 'Cancelling an order',
    body: 'You can cancel from My Orders until the shop accepts the order. After that, only the shop or our team can cancel it. If a paid order is cancelled by anyone, the full amount is refunded to the original payment method.',
  },
  {
    icon: KeyRound,
    tone: 'bg-emerald-50 text-emerald-600',
    title: 'Delivery confirmation',
    body: 'Each order has a one-time delivery code shown in My Orders. The rider needs that code to mark the order delivered, so check the parcel before you share it.',
  },
  {
    icon: RotateCcw,
    tone: 'bg-blue-50 text-blue-600',
    title: 'Wrong or damaged part',
    body: 'Write to support with your order number, the part and a photo. We take it up with the shop that sent it. Replacements and refunds after delivery are agreed case by case; there is no automatic return pickup yet.',
  },
];

export const WarrantyPolicyView: React.FC<WarrantyPolicyViewProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-sb-canvas py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="bg-slate-900 rounded-2xl p-8 md:p-10 text-white border border-slate-800 shadow-xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Returns & cancellations</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            What happens if something goes wrong
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            Every order is packed and sent by a local partner shop. Here is exactly what you can do today, and what is still handled by hand.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SECTIONS.map(({ icon: Icon, tone, title, body }) => (
            <div key={title} className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">{title}</h3>
              <p className="text-slate-600 text-xs leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Privacy</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                The shop sending your order sees your name, phone number and delivery pin so it can deliver. Payments are handled by the payment provider; Spaceborn does not store card details.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigate('orders')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Go to My Orders
            </button>
            <button
              onClick={() => onNavigate('contact')}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Mail className="w-4 h-4" />
              Contact support
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
