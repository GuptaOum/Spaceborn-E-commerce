'use client';

import type { ReactNode } from 'react';

/** Status filter chips with optional counts and the active one highlighted. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  counts,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  counts?: Partial<Record<T, number>>;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {options.map((f) => {
        const active = value === f;
        const n = counts?.[f];
        return (
          <button
            key={f}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {labels?.[f] ?? f}
            {n !== undefined && <span className={`ml-1 ${active ? 'text-slate-300' : 'text-slate-400'}`}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

const TONE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-slate-200 text-slate-700',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TONE[status] ?? 'bg-slate-100 text-slate-700'}`}>{label ?? status}</span>;
}

export function ListState({ loading, error, empty, children }: { loading: boolean; error: string | null; empty: string | null; children?: ReactNode }) {
  return (
    <>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-400">Loading…</p>}
      {!loading && empty && <p className="mt-4 text-sm text-slate-500">{empty}</p>}
      {children}
    </>
  );
}