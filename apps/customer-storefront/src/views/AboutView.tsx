'use client';
import React from 'react';
import {
  Store,
  MapPin,
  Split,
  KeyRound,
  Printer,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { AppView } from '../types';

interface AboutViewProps {
  onNavigate: (view: AppView) => void;
}

const STEPS = [
  {
    icon: Store,
    title: 'Local shops list their stock',
    body: 'Electronics shops in the city sign up on the seller hub, get approved by our team, and keep their prices and stock live on Spaceborn.',
  },
  {
    icon: MapPin,
    title: 'The nearest shop with stock is picked',
    body: 'When you check out, each part is routed to the closest approved shop that has it in stock, and you see that shop, its address and the ETA before you pay.',
  },
  {
    icon: Split,
    title: 'Big carts can be split',
    body: 'If one shop cannot cover the whole cart, the rest goes to the next nearest shop. Checkout shows which shop sends which part, and each part has its own delivery fee.',
  },
  {
    icon: KeyRound,
    title: 'Delivery is confirmed with a code',
    body: 'The shop packs the order and sends it out. You read a one-time code to the rider at the door, so an order is only marked delivered when it reaches you.',
  },
];

const FACTS = [
  { value: '4', label: 'Cities with partner shops' },
  { value: '1', label: 'Cart, many shops' },
  { value: '₹499', label: 'Free delivery per shop above' },
  { value: '0', label: 'Fees to browse or compare' },
];

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-sb-canvas text-sb-ink py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

        <div className="relative rounded-2xl sm:rounded-3xl bg-sb-ink text-white p-6 sm:p-10 md:p-14 overflow-hidden shadow-md border border-sb-ink">
          <div className="absolute -right-16 -top-16 w-96 h-96 bg-[#e2434b]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4 sm:space-y-5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#f8cb46]/15 border border-[#f8cb46]/30 text-[#f8cb46] text-xs font-bold tracking-wide uppercase">
              <Store className="w-3.5 h-3.5" />
              <span>Hyperlocal electronics marketplace</span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              The parts you need, from the shops already near you.
            </h1>

            <p className="text-sb-canvas/80 text-xs sm:text-base leading-relaxed">
              Students, makers and small hardware teams often need one sensor or motor today, not in three days. The shops nearby usually have it, but you can&apos;t see their stock. Spaceborn puts that stock online and sends each order from the closest shop that has the part.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                onClick={() => onNavigate('catalog')}
                className="bg-sb-brand hover:bg-sb-brand-strong text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition shadow-xs cursor-pointer active:scale-95"
              >
                <span>Browse parts near you</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('vendor')}
                className="bg-white/10 hover:bg-white/20 text-white border border-sb-line/40 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                <span>Sell on Spaceborn</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-sb-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-sb-line/60 shadow-xs">
          <div className="max-w-2xl mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-sb-ink">How an order works</h2>
            <p className="text-sb-muted text-xs sm:text-sm mt-1">
              Spaceborn holds no stock and runs no warehouse. Every order is packed by an approved local shop.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="border border-sb-line/60 rounded-2xl p-5 bg-white space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-sb-canvas text-[#e2434b] flex items-center justify-center border border-sb-line/60">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-sb-muted">Step {i + 1}</span>
                </div>
                <h3 className="font-bold text-sb-ink text-sm sm:text-base">{title}</h3>
                <p className="text-sb-muted text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-sb-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-sb-line/60 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sb-canvas text-sb-brand flex items-center justify-center border border-sb-line/60 shadow-xs">
              <Printer className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sb-ink text-base sm:text-lg">3D printing and CNC from local makers</h3>
            <p className="text-sb-muted text-xs sm:text-sm leading-relaxed">
              Upload a design file and makers near you with the right machine send quotes. You pay only after you accept one, and the part is handed over with the same delivery code.
            </p>
            <button
              onClick={() => onNavigate('fabrication')}
              className="text-xs font-bold text-sb-brand hover:underline cursor-pointer"
            >
              Request a fabrication quote →
            </button>
          </div>

          <div className="bg-sb-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-sb-line/60 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sb-canvas text-[#e2434b] flex items-center justify-center border border-sb-line/60 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sb-ink text-base sm:text-lg">What we promise, and what we don&apos;t</h3>
            <p className="text-sb-muted text-xs sm:text-sm leading-relaxed">
              Prices include GST. If you cancel before the shop accepts your order, or the shop cancels it, the payment is refunded to the original method. Spaceborn does not issue GST tax invoices yet and does not offer bulk discounts. Problems with a part are sorted out with the shop that sent it.
            </p>
          </div>
        </div>

        <div className="bg-sb-ink rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-sb-ink shadow-xs text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            {FACTS.map((fact) => (
              <div key={fact.label} className="pt-2 sm:pt-0">
                <div className="text-2xl sm:text-4xl font-black text-[#f8cb46]">{fact.value}</div>
                <p className="text-[11px] sm:text-xs font-medium text-sb-canvas/70 mt-1 uppercase tracking-wider">{fact.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[11px] text-sb-canvas/60">
            Live today in Kanpur, Bengaluru, Chennai and Pune.
          </p>
        </div>

      </div>
    </div>
  );
};
