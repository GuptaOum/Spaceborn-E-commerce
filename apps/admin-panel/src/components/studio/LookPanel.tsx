'use client';

import { useState } from 'react';
import { api, ApiError } from '@spaceborn/web-core/api';
import { useAction, useFeedback } from '@spaceborn/web-core/feedback';
import { formatDateTime } from '@spaceborn/web-core/format';
import {
  contrastOnWhite, resolvePalette, SLIDE_TONES, THEME_PRESET_IDS, THEME_PRESETS, type AdminCategory, type HeroSlide,
  type HomeSection, type StorefrontSettings, type StorefrontVersion,
} from '@spaceborn/web-core/storefront';
import { useDraft } from '@spaceborn/web-core/use-draft';
import { useLoad } from '@spaceborn/web-core/use-load';
import { ListState } from '../ui';
import { input, label, LinkPicker, move, OrderButtons } from './shared';

interface LiveLook {
  settings: StorefrontSettings;
  liveVersion: number | null;
  versions: StorefrontVersion[];
}

const MAX_SLIDES = 6;
const MAX_SECTIONS = 12;
const SECTION_FALLBACK: Partial<Record<HomeSection['type'], string>> = { categories: 'Shop by Category', trending: 'Trending Electronics' };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Problems the API would reject, caught before publishing so the admin sees them in place. */
function problems(s: StorefrontSettings): string[] {
  const out: string[] = [];
  if (s.theme.accent && (!/^#[0-9a-fA-F]{6}$/.test(s.theme.accent) || contrastOnWhite(s.theme.accent) < 4.5)) {
    out.push('The brand colour is too light for white button text. Pick a darker one.');
  }
  if (s.announcement.enabled && !s.announcement.text.trim()) out.push('Write the announcement or switch it off.');
  if (!s.hero.slides.some((x) => x.enabled)) out.push('Keep at least one banner slide switched on.');
  s.hero.slides.forEach((x, i) => {
    if (!x.title.trim()) out.push(`Slide ${i + 1} needs a title.`);
    if (!x.ctaLabel.trim()) out.push(`Slide ${i + 1} needs a button label.`);
    if (x.imageUrl && !/^https:\/\//.test(x.imageUrl)) out.push(`Slide ${i + 1}: the image link must start with https://`);
  });
  s.home.sections.forEach((x, i) => {
    if (x.type === 'category' && !x.categoryId) out.push(`Home row ${i + 1} needs a category.`);
  });
  return out;
}

function Preview({ settings, categories }: { settings: StorefrontSettings; categories: AdminCategory[] }) {
  const p = resolvePalette(settings.theme);
  const slide = settings.hero.slides.find((s) => s.enabled);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 text-[11px]" style={{ background: p.canvas, color: p.ink }}>
      {settings.announcement.enabled && settings.announcement.text && (
        <div className="px-3 py-1 text-center font-semibold text-white" style={{ background: p.ink }}>
          {settings.announcement.text}
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: p.card, borderBottom: `1px solid ${p.line}` }}>
        <span className="font-black">Spaceborn</span>
        <span className="rounded-md px-2 py-0.5 font-bold text-white" style={{ background: p.brand }}>
          Cart
        </span>
      </div>
      <div className="space-y-2 p-3">
        {slide && (
          <div className="rounded-lg p-3" style={{ background: p.card, border: `1px solid ${p.line}` }}>
            <p className="text-[10px] font-bold uppercase" style={{ color: p.muted }}>
              {slide.tag}
            </p>
            <p className="text-sm font-black">
              {slide.title} <span style={{ color: p.brand }}>{slide.highlight}</span>
            </p>
            <span className="mt-2 inline-block rounded-md px-2 py-1 font-bold text-white" style={{ background: p.brand }}>
              {slide.ctaLabel}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {categories.filter((c) => c.isVisible).slice(0, 6).map((c) => (
            <span key={c.id} className="rounded-full px-2 py-0.5 font-semibold" style={{ background: p.card, border: `1px solid ${p.line}` }}>
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlideEditor({
  slide,
  categories,
  onChange,
}: {
  slide: HeroSlide;
  categories: AdminCategory[];
  onChange: (patch: Partial<HeroSlide>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        Small tag above the title
        <input value={slide.tag} maxLength={40} onChange={(e) => onChange({ tag: e.target.value })} className={`mt-1 ${input}`} />
      </label>
      <label className={label}>
        Colour tone
        <select value={slide.tone} onChange={(e) => onChange({ tone: e.target.value as HeroSlide['tone'] })} className={`mt-1 ${input}`}>
          {SLIDE_TONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Title
        <input value={slide.title} maxLength={60} onChange={(e) => onChange({ title: e.target.value })} className={`mt-1 ${input}`} />
      </label>
      <label className={label}>
        Highlighted words (shown in colour after the title)
        <input value={slide.highlight} maxLength={60} onChange={(e) => onChange({ highlight: e.target.value })} className={`mt-1 ${input}`} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Subtitle
        <textarea value={slide.subtitle} maxLength={220} rows={2} onChange={(e) => onChange({ subtitle: e.target.value })} className={`mt-1 ${input}`} />
      </label>
      <label className={label}>
        Button label
        <input value={slide.ctaLabel} maxLength={40} onChange={(e) => onChange({ ctaLabel: e.target.value })} className={`mt-1 ${input}`} />
      </label>
      <label className={label}>
        Button opens
        <div className="mt-1">
          <LinkPicker value={slide.cta} categories={categories} onChange={(cta) => cta && onChange({ cta })} />
        </div>
      </label>
      <label className={label}>
        Badge (optional)
        <input value={slide.badge} maxLength={30} onChange={(e) => onChange({ badge: e.target.value })} className={`mt-1 ${input}`} />
      </label>
      <label className={label}>
        Image link (https, optional)
        <input value={slide.imageUrl} maxLength={500} onChange={(e) => onChange({ imageUrl: e.target.value.trim() })} className={`mt-1 ${input}`} placeholder="https://…" />
      </label>
      {slide.imageUrl.startsWith('https://') && (
        <img src={slide.imageUrl} alt="" className="h-20 w-32 rounded border border-slate-200 object-contain sm:col-span-2" />
      )}
    </div>
  );
}

export function LookPanel({ categories }: { categories: AdminCategory[] }) {
  const { confirm } = useFeedback();
  const live = useLoad(() => api<LiveLook>('/admin/storefront'), []);
  const [draft, setDraft, clearDraft] = useDraft<StorefrontSettings | null>('admin:studio:look', null);
  const [note, setNote, clearNote] = useDraft('admin:studio:look-note', '');
  const [openSlide, setOpenSlide] = useDraft<string | null>('admin:studio:open-slide', null);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const current = live.data?.settings ?? null;
  const editing = draft ?? current;
  const dirty = !!draft && !!current && JSON.stringify(draft) !== JSON.stringify(current);
  const issues = editing ? problems(editing) : [];

  const update = (fn: (s: StorefrontSettings) => StorefrontSettings) => {
    if (editing) setDraft(fn(editing));
    setServerErrors([]);
  };
  const setSlides = (fn: (slides: HeroSlide[]) => HeroSlide[]) => update((s) => ({ ...s, hero: { slides: fn(s.hero.slides) } }));
  const setSections = (fn: (list: HomeSection[]) => HomeSection[]) => update((s) => ({ ...s, home: { sections: fn(s.home.sections) } }));

  const [publish, publishing] = useAction(
    async () => {
      if (!editing) return '';
      const { version } = await api<{ version: StorefrontVersion }>('/admin/storefront/publish', {
        method: 'POST',
        body: { settings: editing, note: note.trim() || undefined },
      });
      clearDraft();
      clearNote();
      await live.refresh();
      return `Version ${version.id} is live on the storefront`;
    },
    {
      success: (m) => m as string,
      onError: (err) => {
        const details = err instanceof ApiError ? (err.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined) : undefined;
        const list = [...(details?.formErrors ?? []), ...Object.values(details?.fieldErrors ?? {}).flat()];
        setServerErrors(list.length ? list : [err.message]);
        return true;
      },
    },
  );

  const [restore, restoring] = useAction(
    async (v: StorefrontVersion) => {
      const ok = await confirm({
        title: `Put version ${v.id} back live?`,
        body: 'It is published as a new version, so you can switch back again from this list.' + (dirty ? ' Your unpublished edits will be discarded.' : ''),
        confirmLabel: 'Restore',
      });
      if (!ok) return '';
      const { version } = await api<{ version: StorefrontVersion }>(`/admin/storefront/versions/${v.id}/restore`, { method: 'POST' });
      clearDraft();
      await live.refresh();
      return `Version ${v.id} restored as version ${version.id}`;
    },
    { success: (m) => m as string },
  );

  const hasSection = (type: HomeSection['type']) => !!editing?.home.sections.some((s) => s.type === type);

  return (
    <ListState loading={live.loading} error={live.error} empty={null}>
      {editing && live.data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Section title="Colour theme" hint="Pick a designed palette. A custom brand colour replaces the buttons and highlights.">
              <div className="grid gap-2 sm:grid-cols-2">
                {THEME_PRESET_IDS.map((id) => {
                  const preset = THEME_PRESETS[id];
                  const active = editing.theme.preset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update((s) => ({ ...s, theme: { ...s.theme, preset: id } }))}
                      className={`flex items-center gap-3 rounded-lg border p-2 text-left text-sm ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'}`}
                    >
                      <span className="flex overflow-hidden rounded">
                        {[preset.palette.canvas, preset.palette.card, preset.palette.line, preset.palette.brand, preset.palette.ink].map((c) => (
                          <span key={c} className="h-6 w-4" style={{ background: c }} />
                        ))}
                      </span>
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className={label}>Custom brand colour</label>
                <input
                  type="color"
                  value={editing.theme.accent ?? resolvePalette({ preset: editing.theme.preset, accent: null }).brand}
                  onChange={(e) => update((s) => ({ ...s, theme: { ...s.theme, accent: e.target.value } }))}
                  className="h-8 w-12 cursor-pointer rounded border border-slate-300"
                />
                {editing.theme.accent ? (
                  <>
                    <span className="font-mono text-xs">{editing.theme.accent}</span>
                    <span className={`text-xs ${contrastOnWhite(editing.theme.accent) >= 4.5 ? 'text-emerald-700' : 'text-red-600'}`}>
                      contrast {contrastOnWhite(editing.theme.accent).toFixed(1)}:1 {contrastOnWhite(editing.theme.accent) >= 4.5 ? '(readable)' : '(too light, needs 4.5)'}
                    </span>
                    <button type="button" onClick={() => update((s) => ({ ...s, theme: { ...s.theme, accent: null } }))} className="text-xs font-semibold text-slate-600 underline">
                      Use the theme&apos;s colour
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">Using the theme&apos;s own colour</span>
                )}
              </div>
            </Section>

            <Section title="Announcement bar" hint="One line above the header on every page.">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.announcement.enabled}
                  onChange={(e) => update((s) => ({ ...s, announcement: { ...s.announcement, enabled: e.target.checked } }))}
                />
                Show the announcement
              </label>
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_220px]">
                <input
                  value={editing.announcement.text}
                  maxLength={140}
                  onChange={(e) => update((s) => ({ ...s, announcement: { ...s.announcement, text: e.target.value } }))}
                  className={input}
                  placeholder="Free delivery on orders above ₹499 from each shop"
                />
                <LinkPicker
                  allowNone
                  value={editing.announcement.cta}
                  categories={categories}
                  onChange={(cta) => update((s) => ({ ...s, announcement: { ...s.announcement, cta } }))}
                />
              </div>
            </Section>

            <Section title={`Banner slides (${editing.hero.slides.length} of ${MAX_SLIDES})`} hint="The rotating banner at the top of the home page. Switched-off slides are kept but not shown.">
              <ul className="space-y-2">
                {editing.hero.slides.map((slide, i) => {
                  const open = openSlide === slide.id;
                  return (
                    <li key={slide.id} className="rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 p-2">
                        <OrderButtons index={i} length={editing.hero.slides.length} onMove={(d) => setSlides((list) => move(list, i, d))} />
                        <input
                          type="checkbox"
                          checked={slide.enabled}
                          title="Show this slide"
                          onChange={(e) => setSlides((list) => list.map((x) => (x.id === slide.id ? { ...x, enabled: e.target.checked } : x)))}
                        />
                        <button type="button" onClick={() => setOpenSlide(open ? null : slide.id)} className={`min-w-0 flex-1 truncate text-left text-sm ${slide.enabled ? 'font-medium' : 'text-slate-400'}`}>
                          {slide.title} {slide.highlight}
                        </button>
                        <button
                          type="button"
                          disabled={editing.hero.slides.length <= 1}
                          onClick={() => setSlides((list) => list.filter((x) => x.id !== slide.id))}
                          className="text-xs font-semibold text-red-600 disabled:opacity-30"
                        >
                          Delete
                        </button>
                      </div>
                      {open && (
                        <div className="border-t border-slate-100 p-3">
                          <SlideEditor
                            slide={slide}
                            categories={categories}
                            onChange={(patch) => setSlides((list) => list.map((x) => (x.id === slide.id ? { ...x, ...patch } : x)))}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                disabled={editing.hero.slides.length >= MAX_SLIDES}
                onClick={() => {
                  const id = `slide-${Date.now().toString(36)}`;
                  setSlides((list) => [
                    ...list,
                    { id, enabled: true, tone: 'plum', tag: '', title: 'New slide', highlight: '', subtitle: '', badge: '', ctaLabel: 'Shop now', cta: { kind: 'page', page: 'catalog' }, imageUrl: '' },
                  ]);
                  setOpenSlide(id);
                }}
                className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                Add slide
              </button>
            </Section>

            <Section title="Home page rows" hint="Shown below the banner, top to bottom. Category rows show up to 8 products in stock near the customer.">
              <ul className="space-y-2">
                {editing.home.sections.map((section, i) => (
                  <li key={section.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <OrderButtons index={i} length={editing.home.sections.length} onMove={(d) => setSections((list) => move(list, i, d))} />
                    <input
                      type="checkbox"
                      checked={section.visible}
                      title="Show this row"
                      onChange={(e) => setSections((list) => list.map((x) => (x.id === section.id ? { ...x, visible: e.target.checked } : x)))}
                    />
                    <span className="w-24 shrink-0 text-xs font-semibold uppercase text-slate-400">
                      {section.type === 'categories' ? 'Category tiles' : section.type === 'trending' ? 'Trending' : 'Category row'}
                    </span>
                    {section.type === 'category' && (
                      <select
                        value={section.categoryId ?? ''}
                        onChange={(e) => setSections((list) => list.map((x) => (x.id === section.id ? { ...x, categoryId: e.target.value } : x)))}
                        className={`${input} w-44`}
                      >
                        <option value="">Pick a category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      value={section.title}
                      maxLength={60}
                      placeholder={`Title (blank shows "${SECTION_FALLBACK[section.type] ?? categories.find((c) => c.id === section.categoryId)?.name ?? 'the category name'}")`}
                      onChange={(e) => setSections((list) => list.map((x) => (x.id === section.id ? { ...x, title: e.target.value } : x)))}
                      className={`${input} min-w-40 flex-1`}
                    />
                    <input
                      value={section.subtitle}
                      maxLength={120}
                      placeholder="Subtitle (optional)"
                      onChange={(e) => setSections((list) => list.map((x) => (x.id === section.id ? { ...x, subtitle: e.target.value } : x)))}
                      className={`${input} min-w-40 flex-1`}
                    />
                    <button type="button" onClick={() => setSections((list) => list.filter((x) => x.id !== section.id))} className="text-xs font-semibold text-red-600">
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={editing.home.sections.length >= MAX_SECTIONS}
                  onClick={() => setSections((list) => [...list, { id: `rail-${Date.now().toString(36)}`, type: 'category', categoryId: '', title: '', subtitle: '', visible: true }])}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                >
                  Add category row
                </button>
                {!hasSection('categories') && (
                  <button type="button" onClick={() => setSections((list) => [{ id: 'categories', type: 'categories', title: 'Shop by Category', subtitle: '', visible: true }, ...list])} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">
                    Add category tiles
                  </button>
                )}
                {!hasSection('trending') && (
                  <button type="button" onClick={() => setSections((list) => [...list, { id: 'trending', type: 'trending', title: 'Trending Electronics', subtitle: '', visible: true }])} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">
                    Add trending row
                  </button>
                )}
              </div>
            </Section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold">Preview</h3>
              <p className="mb-3 text-xs text-slate-500">Colours and the first banner slide, as customers will see them.</p>
              <Preview settings={editing} categories={categories} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm">
                {dirty ? <span className="font-semibold text-amber-700">Unpublished changes</span> : <span className="text-slate-500">Matches the live storefront</span>}
              </p>
              {[...issues, ...serverErrors].length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-red-700">
                  {[...issues, ...serverErrors].map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="What changed? (optional)" className={`mt-3 ${input}`} />
              <div className="mt-2 flex gap-2">
                <button
                  disabled={!dirty || publishing || issues.length > 0}
                  onClick={() => void publish()}
                  className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {publishing ? 'Publishing…' : 'Publish to storefront'}
                </button>
                <button disabled={!dirty} onClick={() => { clearDraft(); setServerErrors([]); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">
                  Discard
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold">History</h3>
              {live.data.versions.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">Nothing published yet; customers see the built-in design.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 text-xs">
                  {live.data.versions.map((v) => (
                    <li key={v.id} className="flex items-start justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          Version {v.id}
                          {v.id === live.data!.liveVersion && <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">LIVE</span>}
                        </p>
                        <p className="truncate text-slate-500">{v.note ?? 'No note'}</p>
                        <p className="text-slate-400">
                          {v.publishedBy} · {formatDateTime(v.createdAt)}
                        </p>
                      </div>
                      {v.id !== live.data!.liveVersion && (
                        <button disabled={restoring} onClick={() => void restore(v)} className="shrink-0 rounded border border-slate-300 px-2 py-0.5 font-semibold disabled:opacity-40">
                          Restore
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </ListState>
  );
}
