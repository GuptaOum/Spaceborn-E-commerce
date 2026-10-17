'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { AppView } from '../types';
import { useStorefront } from '../context/StorefrontConfig';
import { followCta } from '../lib/cta';

/** The one-line message an admin can publish above the header from Storefront Studio. */
export const AnnouncementBar: React.FC<{
  onNavigate: (view: AppView) => void;
  onSelectCategory: (category: string) => void;
}> = ({ onNavigate, onSelectCategory }) => {
  const { settings, categories } = useStorefront();
  const bar = settings?.announcement;
  if (!bar?.enabled || !bar.text) return null;
  const cta = bar.cta;
  const content = (
    <>
      <span className="truncate">{bar.text}</span>
      {cta && <ArrowRight className="w-3.5 h-3.5 shrink-0" />}
    </>
  );
  return (
    <div className="bg-sb-ink text-white text-[11px] sm:text-xs font-semibold">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex justify-center">
        {cta ? (
          <button
            type="button"
            onClick={() => followCta(cta, categories, onNavigate, onSelectCategory)}
            className="inline-flex items-center gap-1.5 min-w-0 hover:underline cursor-pointer"
          >
            {content}
          </button>
        ) : (
          <p className="inline-flex items-center gap-1.5 min-w-0">{content}</p>
        )}
      </div>
    </div>
  );
};
