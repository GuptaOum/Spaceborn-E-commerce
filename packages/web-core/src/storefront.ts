/** Storefront Studio: settings shape shared by the admin editor and the storefront renderer. */

export const THEME_PRESET_IDS = ['sunrise', 'ocean', 'mint', 'graphite'] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

export const CTA_PAGES = ['catalog', 'fabrication', 'b2b', 'datasheets', 'compare', 'about', 'contact', 'warranty'] as const;
export type CtaPage = (typeof CTA_PAGES)[number];

export const SLIDE_TONES = ['sky', 'coral', 'green', 'amber', 'plum'] as const;
export type SlideTone = (typeof SLIDE_TONES)[number];

export const CATEGORY_ICONS = [
  'cpu', 'radio', 'cog', 'battery', 'bot', 'wrench', 'printer', 'cable', 'package', 'box', 'zap', 'layers', 'plane',
  'lightbulb', 'monitor', 'shield',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export type Cta = { kind: 'page'; page: CtaPage } | { kind: 'category'; categoryId: string };

export interface HeroSlide {
  id: string;
  enabled: boolean;
  tone: SlideTone;
  tag: string;
  title: string;
  highlight: string;
  subtitle: string;
  badge: string;
  ctaLabel: string;
  cta: Cta;
  imageUrl: string;
}

export interface HomeSection {
  id: string;
  type: 'categories' | 'trending' | 'category';
  categoryId?: string;
  title: string;
  subtitle: string;
  visible: boolean;
}

export interface StorefrontSettings {
  theme: { preset: ThemePresetId; accent: string | null };
  announcement: { enabled: boolean; text: string; cta: Cta | null };
  hero: { slides: HeroSlide[] };
  home: { sections: HomeSection[] };
}

export interface StorefrontCategory {
  id: string;
  name: string;
  icon: CategoryIcon | string;
  description: string;
}

export interface StorefrontConfig {
  settings: StorefrontSettings;
  version: number | null;
  categories: StorefrontCategory[];
}

export interface AdminCategory extends StorefrontCategory {
  keywords: string[];
  isVisible: boolean;
  sortOrder: number;
  productCount: number;
}

export interface CategorySuggestion {
  productId: string;
  sku: string;
  name: string;
  currentCategoryId: string;
  suggestedCategoryId: string;
  margin: number;
  keywordHits: number;
  similarity: number | null;
  recommended: boolean;
}

export interface StorefrontVersion {
  id: number;
  note: string | null;
  publishedBy: string;
  restoredFrom: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------------------------
// Themes

export interface Palette {
  canvas: string;
  card: string;
  line: string;
  ink: string;
  muted: string;
  brand: string;
  brandStrong: string;
  brandSoft: string;
}

export const THEME_PRESETS: Record<ThemePresetId, { label: string; palette: Palette }> = {
  sunrise: {
    label: 'Sunrise (warm cream)',
    palette: { canvas: '#fee9d7', card: '#fffbf7', line: '#f9bf8f', ink: '#34222e', muted: '#7a6274', brand: '#0c831f', brandStrong: '#0a6e1a', brandSoft: '#f2fcf4' },
  },
  ocean: {
    label: 'Ocean (cool blue)',
    palette: { canvas: '#e7f0fa', card: '#f8fbff', line: '#a9c8e8', ink: '#15263b', muted: '#5a6f87', brand: '#0b63c4', brandStrong: '#0950a0', brandSoft: '#ebf3fd' },
  },
  mint: {
    label: 'Mint (fresh green)',
    palette: { canvas: '#e6f4ec', card: '#fafefb', line: '#a8d5ba', ink: '#163029', muted: '#587168', brand: '#0f7a5c', brandStrong: '#0b5f48', brandSoft: '#e8f6f0' },
  },
  graphite: {
    label: 'Graphite (neutral grey)',
    palette: { canvas: '#eceef1', card: '#fbfbfc', line: '#c6cbd3', ink: '#1d2229', muted: '#5e6774', brand: '#0c831f', brandStrong: '#0a6e1a', brandSoft: '#eef7f0' },
  },
};

function mix(hex: string, other: string, weight: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const out = [1, 3, 5].map((i) => Math.round(ch(hex, i) * (1 - weight) + ch(other, i) * weight));
  return `#${out.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** The palette for a theme, with the accent (if any) replacing the brand colour and its shades. */
export function resolvePalette(theme: StorefrontSettings['theme']): Palette {
  const base = THEME_PRESETS[theme.preset]?.palette ?? THEME_PRESETS.sunrise.palette;
  if (!theme.accent) return base;
  return { ...base, brand: theme.accent, brandStrong: mix(theme.accent, '#000000', 0.15), brandSoft: mix(theme.accent, '#ffffff', 0.92) };
}

/** CSS custom properties read by the storefront's `sb-*` colour utilities. */
export function paletteVars(p: Palette): Record<string, string> {
  return {
    '--color-sb-canvas': p.canvas,
    '--color-sb-card': p.card,
    '--color-sb-line': p.line,
    '--color-sb-ink': p.ink,
    '--color-sb-muted': p.muted,
    '--color-sb-brand': p.brand,
    '--color-sb-brand-strong': p.brandStrong,
    '--color-sb-brand-soft': p.brandSoft,
  };
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio of white text on this colour; the API rejects accents below 4.5. */
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);
