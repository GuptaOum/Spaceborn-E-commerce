import { z } from 'zod';

export const THEME_PRESETS = ['sunrise', 'ocean', 'mint', 'graphite'] as const;
export const CTA_PAGES = ['catalog', 'fabrication', 'b2b', 'datasheets', 'compare', 'about', 'contact', 'warranty'] as const;
export const SLIDE_TONES = ['sky', 'coral', 'green', 'amber', 'plum'] as const;

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Contrast ratio against white, which is the text colour on every brand-coloured button. */
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

const text = (max: number) => z.string().trim().max(max);

// Links stay inside the storefront: a page from a fixed list or a category. Admins cannot point
// customers at arbitrary URLs from the banner.
const cta = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('page'), page: z.enum(CTA_PAGES) }),
  z.object({ kind: z.literal('category'), categoryId: z.string().trim().min(1).max(60) }),
]);

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\/[^\s"'<>]+$/.test(v), 'Use an https:// image link');

const heroSlide = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{1,40}$/),
  enabled: z.boolean(),
  tone: z.enum(SLIDE_TONES),
  tag: text(40),
  title: text(60).min(1, 'Every slide needs a title'),
  highlight: text(60),
  subtitle: text(220),
  badge: text(30),
  ctaLabel: text(40).min(1, 'Every slide needs a button label'),
  cta,
  imageUrl,
});

const homeSection = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9-]{1,40}$/),
    type: z.enum(['categories', 'trending', 'category']),
    categoryId: z.string().trim().min(1).max(60).optional(),
    title: text(60),
    subtitle: text(120),
    visible: z.boolean(),
  })
  .refine((s) => s.type !== 'category' || !!s.categoryId, { message: 'Pick a category for this row', path: ['categoryId'] });

export const storefrontSettings = z.object({
  theme: z.object({
    preset: z.enum(THEME_PRESETS),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #0c831f')
      .refine((c) => contrastOnWhite(c) >= 4.5, 'White button text would be hard to read on this colour; pick a darker one')
      .nullable(),
  }),
  announcement: z.object({
    enabled: z.boolean(),
    text: text(140),
    cta: cta.nullable(),
  }).refine((a) => !a.enabled || a.text.length > 0, { message: 'Write the announcement or turn it off', path: ['text'] }),
  hero: z.object({
    slides: z.array(heroSlide).min(1).max(6).refine((s) => s.some((x) => x.enabled), 'Keep at least one slide switched on'),
  }),
  home: z.object({
    sections: z.array(homeSection).max(12),
  }),
}).superRefine((s, ctx) => {
  const unique = (ids: string[], path: string) => {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate id', path: [path] });
  };
  unique(s.hero.slides.map((x) => x.id), 'hero');
  unique(s.home.sections.map((x) => x.id), 'home');
});

export type StorefrontSettings = z.infer<typeof storefrontSettings>;

export const DEFAULT_SETTINGS: StorefrontSettings = {
  theme: { preset: 'sunrise', accent: null },
  announcement: {
    enabled: false,
    text: 'Free delivery on orders above ₹499 from each shop',
    cta: { kind: 'page', page: 'catalog' },
  },
  hero: {
    slides: [
      {
        id: 'fabrication', enabled: true, tone: 'sky', tag: 'On-demand fabrication',
        title: 'Precision', highlight: '3D Printing & CNC Machining',
        subtitle: 'Upload your design file and a local maker with the right machine sends you a quote. You pay only if you accept it.',
        badge: 'Quotes from local makers', ctaLabel: 'Start a print or CNC request', cta: { kind: 'page', page: 'fabrication' },
        imageUrl: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/QRTZ1n9FqJpexURRjj346cRuDgh8CIXmACjH2W21.webp',
      },
      {
        id: 'laser-cnc', enabled: true, tone: 'coral', tag: 'Laser & CNC hardware',
        title: 'AtomStack', highlight: 'Laser Cutters & CNC Routers',
        subtitle: 'Laser modules, cutting beds and desktop gantry kits for prototyping and custom enclosures.',
        badge: 'From shops near you', ctaLabel: 'Explore 3D printing & CNC', cta: { kind: 'category', categoryId: '3d-printing' },
        imageUrl: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/TuNlwhjy7hrjVgrc35BW4CoxkD1BKLCoIExes2rM.webp',
      },
      {
        id: 'dev-boards', enabled: true, tone: 'sky', tag: 'Microcontrollers & AI compute',
        title: 'Raspberry Pi 5 &', highlight: 'Edge AI Compute Kits',
        subtitle: 'Raspberry Pi, Arduino, ESP32 and Jetson boards stocked by local electronics shops.',
        badge: 'Live local stock', ctaLabel: 'Explore dev boards', cta: { kind: 'category', categoryId: 'dev-boards' },
        imageUrl: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/iwKr8PucqQv18bbgVPs2Pq56jydYwpR2JIZ0eQ3q.webp',
      },
      {
        id: 'express', enabled: true, tone: 'green', tag: 'Nearest-shop delivery',
        title: 'Arduino, ESP32 &', highlight: 'Sensors, Delivered Fast',
        subtitle: 'Sent by the nearest shop that has them, with the delivery time shown before you pay.',
        badge: 'Free delivery ₹499+', ctaLabel: 'Shop the catalog', cta: { kind: 'page', page: 'catalog' },
        imageUrl: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/u9XlzD9ZM45DD7v7fUZ4vpVUt67ZdPmISg6BlCd1.webp',
      },
      {
        id: 'motors', enabled: true, tone: 'amber', tag: 'Robotics & drone propulsion',
        title: 'Brushless Motors &', highlight: 'Drone ESC Modules',
        subtitle: 'Planetary gearboxes, stepper motors and LiPo packs for robots and drones.',
        badge: 'Compare across shops', ctaLabel: 'View motors & drivers', cta: { kind: 'category', categoryId: 'motors' },
        imageUrl: 'https://robu-prod-media.s3.ap-south-1.amazonaws.com/theme/16/IOwkD9oyO090Cu2A7W0HAkQWsKLZj8GtO216E1jv.webp',
      },
    ],
  },
  home: {
    sections: [
      { id: 'categories', type: 'categories', title: 'Shop by Category', subtitle: '', visible: true },
      { id: 'trending', type: 'trending', title: 'Trending Electronics', subtitle: 'Popular components ordered for projects and prototyping', visible: true },
      { id: 'rail-dev-boards', type: 'category', categoryId: 'dev-boards', title: 'Development Boards & Microcontrollers', subtitle: 'ESP32, Raspberry Pi, Arduino and STM32 boards', visible: true },
      { id: 'rail-3d-printing', type: 'category', categoryId: '3d-printing', title: '3D Printing & CNC', subtitle: 'Printers, filament, laser engravers and CNC machines', visible: true },
      { id: 'rail-sensors', type: 'category', categoryId: 'sensors', title: 'Sensors & Modules', subtitle: 'Distance, motion, vision and environment sensing', visible: true },
    ],
  },
};
