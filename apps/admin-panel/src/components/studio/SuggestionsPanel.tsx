'use client';

import { useMemo, useState } from 'react';
import { api } from '@spaceborn/web-core/api';
import { useAction } from '@spaceborn/web-core/feedback';
import type { AdminCategory, CategorySuggestion } from '@spaceborn/web-core/storefront';
import { input } from './shared';

interface Scan {
  scanned: number;
  suggestions: CategorySuggestion[];
}

/**
 * Finds products sitting on the wrong shelf. Each product is scored against every category by
 * keyword matches from the category's definition plus pgvector cosine similarity between the
 * product's embedding and the category's embedded description.
 */
export function SuggestionsPanel({ categories, onMoved }: { categories: AdminCategory[]; onMoved: () => void }) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const name = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const [run, scanning] = useAction(async () => {
    const result = await api<Scan>('/admin/categories/suggestions');
    setScan(result);
    setPicked(Object.fromEntries(result.suggestions.filter((s) => s.recommended).map((s) => [s.productId, s.suggestedCategoryId])));
  });

  const [applyMoves, applying] = useAction(
    async () => {
      const moves = Object.entries(picked).map(([productId, categoryId]) => ({ productId, categoryId }));
      if (moves.length === 0) return '';
      const { moved } = await api<{ moved: number }>('/admin/categories/suggestions/apply', { method: 'POST', body: { moves } });
      onMoved();
      await run();
      return `${moved} product${moved === 1 ? '' : 's'} moved to the right shelf`;
    },
    { success: (m) => m as string },
  );

  const selected = Object.keys(picked).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-700">
          Smart sorting checks every product against every category. A product scores points for each of the
          category&apos;s keywords in its title (and a little for its description), plus its <b>pgvector</b> similarity
          to the category&apos;s embedded description. When another category clearly wins, it is suggested here.
          Nothing moves until you apply it.
        </p>
        <button onClick={() => void run()} disabled={scanning} className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {scanning ? 'Scanning…' : scan ? 'Scan again' : 'Scan catalog'}
        </button>
      </div>

      {scan && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3">
            <p className="text-sm text-slate-600">
              Scanned <b>{scan.scanned}</b> products · <b>{scan.suggestions.length}</b> could sit better elsewhere · {selected} selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPicked(Object.fromEntries(scan.suggestions.filter((s) => s.recommended).map((s) => [s.productId, s.suggestedCategoryId])))}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold"
              >
                Select confident ones
              </button>
              <button type="button" onClick={() => setPicked({})} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold">
                Clear
              </button>
              <button
                disabled={applying || selected === 0}
                onClick={() => void applyMoves()}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                {applying ? 'Moving…' : `Move ${selected} product${selected === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
          {scan.suggestions.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Every product is already on its best-matching shelf.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 w-8" />
                  <th className="p-2">Product</th>
                  <th className="p-2">Now in</th>
                  <th className="p-2">Move to</th>
                  <th className="p-2 text-right" title="How far ahead the suggestion is; 1 is about one extra keyword match">Lead</th>
                  <th className="p-2 text-right" title="Cosine similarity between product and category embeddings">Vector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scan.suggestions.map((s) => {
                  const checked = s.productId in picked;
                  return (
                    <tr key={s.productId} className={checked ? 'bg-emerald-50/50' : ''}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setPicked((p) => {
                              const next = { ...p };
                              if (checked) delete next[s.productId];
                              else next[s.productId] = s.suggestedCategoryId;
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <p className="font-medium">{s.name}</p>
                        <p className="font-mono text-[11px] text-slate-400">{s.sku}</p>
                      </td>
                      <td className="p-2 text-slate-600">{name.get(s.currentCategoryId) ?? s.currentCategoryId}</td>
                      <td className="p-2">
                        <select
                          value={picked[s.productId] ?? s.suggestedCategoryId}
                          onChange={(e) => setPicked((p) => ({ ...p, [s.productId]: e.target.value }))}
                          className={`${input} py-1`}
                        >
                          {categories.filter((c) => c.id !== s.currentCategoryId).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`p-2 text-right font-mono text-xs ${s.recommended ? 'text-emerald-700' : 'text-slate-400'}`}>{s.margin.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono text-xs text-slate-500">{s.similarity === null ? '—' : s.similarity.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
