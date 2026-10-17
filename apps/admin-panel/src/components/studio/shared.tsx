'use client';

import { CTA_PAGES, type AdminCategory, type Cta, type CtaPage } from '@spaceborn/web-core/storefront';

export const PAGE_LABEL: Record<CtaPage, string> = {
  catalog: 'Catalog',
  fabrication: '3D print / CNC request',
  b2b: 'Business (B2B) orders',
  datasheets: 'Datasheet library',
  compare: 'Compare',
  about: 'About',
  contact: 'Contact',
  warranty: 'Warranty',
};

export const input = 'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm';
export const label = 'block text-xs font-semibold text-slate-600';

const encode = (cta: Cta | null) => (!cta ? '' : cta.kind === 'page' ? `page:${cta.page}` : `category:${cta.categoryId}`);

function decode(value: string): Cta | null {
  const [kind, target] = value.split(':') as [string, string];
  if (kind === 'page') return { kind: 'page', page: target as CtaPage };
  if (kind === 'category') return { kind: 'category', categoryId: target };
  return null;
}

/** Where a banner button goes: one of the storefront's pages or a category shelf. */
export function LinkPicker({
  value,
  onChange,
  categories,
  allowNone = false,
}: {
  value: Cta | null;
  onChange: (cta: Cta | null) => void;
  categories: AdminCategory[];
  allowNone?: boolean;
}) {
  return (
    <select value={encode(value)} onChange={(e) => onChange(decode(e.target.value))} className={input}>
      {allowNone && <option value="">No link</option>}
      <optgroup label="Pages">
        {CTA_PAGES.map((p) => (
          <option key={p} value={`page:${p}`}>
            {PAGE_LABEL[p]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Categories">
        {categories.map((c) => (
          <option key={c.id} value={`category:${c.id}`}>
            {c.name}
            {c.isVisible ? '' : ' (hidden)'}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

/** Moves an item one place up or down in a list. */
export function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function OrderButtons({ index, length, onMove }: { index: number; length: number; onMove: (delta: -1 | 1) => void }) {
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="px-1 text-xs leading-none text-slate-500 hover:text-slate-900 disabled:opacity-25" aria-label="Move up">
        ▲
      </button>
      <button type="button" disabled={index === length - 1} onClick={() => onMove(1)} className="px-1 text-xs leading-none text-slate-500 hover:text-slate-900 disabled:opacity-25" aria-label="Move down">
        ▼
      </button>
    </span>
  );
}
