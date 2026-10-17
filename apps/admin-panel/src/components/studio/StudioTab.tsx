'use client';

import { api } from '@spaceborn/web-core/api';
import { useDraft } from '@spaceborn/web-core/use-draft';
import { useLoad } from '@spaceborn/web-core/use-load';
import { CategoriesPanel, type CategoryList } from './CategoriesPanel';
import { LookPanel } from './LookPanel';
import { SuggestionsPanel } from './SuggestionsPanel';

type StudioView = 'categories' | 'sorting' | 'look';

const VIEWS: { id: StudioView; label: string; hint: string }[] = [
  { id: 'categories', label: 'Categories', hint: 'The shelves customers browse. Keep between 5 and 12 visible.' },
  { id: 'sorting', label: 'Smart sorting', hint: 'Move products that sit on the wrong shelf.' },
  { id: 'look', label: 'Look & content', hint: 'Theme, announcement, banner and home page rows. Publish when ready; every version can be restored.' },
];

/** Lets platform admins run the storefront's shelves and design without a code change. */
export function StudioTab() {
  const [view, setView] = useDraft<StudioView>('admin:studio:tab', 'categories');
  const list = useLoad(() => api<CategoryList>('/admin/categories'), []);
  const categories = list.data?.categories ?? [];
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 w-fit">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-500">{current.hint}</p>

      {current.id === 'categories' && <CategoriesPanel list={list} onChanged={() => void list.refresh()} />}
      {current.id === 'sorting' && <SuggestionsPanel categories={categories} onMoved={() => void list.refresh()} />}
      {current.id === 'look' && <LookPanel categories={categories} />}
    </div>
  );
}
