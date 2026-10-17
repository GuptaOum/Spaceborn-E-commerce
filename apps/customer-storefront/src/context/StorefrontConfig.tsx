'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@spaceborn/web-core/api';
import {
  paletteVars, resolvePalette, type StorefrontCategory, type StorefrontConfig, type StorefrontSettings,
} from '@spaceborn/web-core/storefront';
import { THEME_VARS_KEY } from '../lib/themeStorage';
import type { Product } from '../types';

const STOREFRONT_CACHE_KEY = 'sb_storefront_v1';

const ALL = new Set(['all', 'all categories', 'all items', 'all products', '']);

// Names older links and saved sessions may still use for a shelf.
const LEGACY_NAMES: Record<string, string> = {
  'development boards': 'dev-boards',
  'dev boards': 'dev-boards',
  'batteries & chargers': 'power',
  'tools & accessories': 'accessories',
  'tools & soldering': 'accessories',
  'mechanical & frames': 'mechanical',
  'robotics & mechanical': 'mechanical',
  'print & cnc': '3d-printing',
};

interface StorefrontContextValue {
  /** Null until the first response (or the cached copy) arrives. */
  settings: StorefrontSettings | null;
  categories: StorefrontCategory[];
  loaded: boolean;
  isAll: (filter: string) => boolean;
  /** Finds a shelf by id, current name or a legacy name. */
  resolveCategory: (filter: string) => StorefrontCategory | null;
  inCategory: (product: Product, filter: string) => boolean;
}

const StorefrontContext = createContext<StorefrontContextValue | undefined>(undefined);

function applyTheme(settings: StorefrontSettings) {
  const vars = paletteVars(resolvePalette(settings.theme));
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  try {
    localStorage.setItem(THEME_VARS_KEY, JSON.stringify(vars));
  } catch {
    // Without the cache the next visit briefly shows the default colours.
  }
}

export const StorefrontProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<StorefrontConfig | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(STOREFRONT_CACHE_KEY);
      if (cached) setConfig(JSON.parse(cached) as StorefrontConfig);
    } catch {
      // A corrupt cache just means waiting for the network copy.
    }
    let cancelled = false;
    api<StorefrontConfig>('/storefront')
      .then((fresh) => {
        if (cancelled) return;
        setConfig(fresh);
        try {
          localStorage.setItem(STOREFRONT_CACHE_KEY, JSON.stringify(fresh));
        } catch {
          // Storage full or blocked: the look still applies for this visit.
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (config?.settings) applyTheme(config.settings);
  }, [config?.settings]);

  const categories = config?.categories ?? [];

  const isAll = useCallback((filter: string) => ALL.has(filter.trim().toLowerCase()), []);

  const resolveCategory = useCallback(
    (filter: string) => {
      const norm = filter.trim().toLowerCase();
      if (ALL.has(norm)) return null;
      return (
        categories.find((c) => c.id === norm || c.name.toLowerCase() === norm) ??
        categories.find((c) => c.id === LEGACY_NAMES[norm]) ??
        null
      );
    },
    [categories],
  );

  const inCategory = useCallback(
    (product: Product, filter: string) => {
      if (isAll(filter)) return true;
      const cat = resolveCategory(filter);
      // A shelf that was renamed or removed since the link was made shows everything rather than nothing.
      if (!cat) return true;
      return product.categoryId ? product.categoryId === cat.id : product.category.toLowerCase() === cat.name.toLowerCase();
    },
    [isAll, resolveCategory],
  );

  const value = useMemo<StorefrontContextValue>(
    () => ({ settings: config?.settings ?? null, categories, loaded: !!config, isAll, resolveCategory, inCategory }),
    [config, categories, isAll, resolveCategory, inCategory],
  );

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
};

export function useStorefront() {
  const ctx = useContext(StorefrontContext);
  if (!ctx) throw new Error('useStorefront must be used within a StorefrontProvider');
  return ctx;
}
