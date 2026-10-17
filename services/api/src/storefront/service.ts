import type pg from 'pg';
import { categoryAnchorText, scoreCategories } from '../catalog/categories.js';
import { currentTextModel, embedText, toPgVector } from '../catalog/embeddings.js';
import { pool, withTransaction, type Db } from '../db/pool.js';
import { conflict, notFound, unprocessable } from '../errors.js';
import { DEFAULT_SETTINGS, storefrontSettings, type StorefrontSettings } from './settings.js';

export const MIN_VISIBLE_CATEGORIES = 5;
export const MAX_CATEGORIES = 12;

export interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  icon: string;
  isVisible: boolean;
  sortOrder: number;
  productCount: number;
}

const CATEGORY_COLUMNS = `
  c.id, c.name, c.description, c.keywords, c.icon, c.is_visible as "isVisible", c.sort_order as "sortOrder",
  (select count(*)::int from products p where p.category_id = c.id and p.is_active) as "productCount"`;

export async function listCategories(db: Db = pool, opts: { visibleOnly?: boolean } = {}): Promise<Category[]> {
  const { rows } = await db.query<Category>(
    `select ${CATEGORY_COLUMNS} from categories c
      where ($1::boolean is false or c.is_visible)
      order by c.sort_order, c.name`,
    [opts.visibleOnly ?? false],
  );
  return rows;
}

/**
 * Runs a category change under a table lock and re-checks the shelf rules before committing, so
 * two admins editing at once cannot push it past 12 or below 5 visible.
 */
async function withShelfRules<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(async (c) => {
    await c.query('lock table categories in share row exclusive mode');
    const result = await fn(c);
    const { rows } = await c.query<{ total: number; visible: number }>(
      'select count(*)::int as total, count(*) filter (where is_visible)::int as visible from categories',
    );
    const { total, visible } = rows[0]!;
    if (total > MAX_CATEGORIES) {
      throw unprocessable('too_many_categories', `The storefront can have at most ${MAX_CATEGORIES} categories. Remove one first.`);
    }
    if (visible < MIN_VISIBLE_CATEGORIES) {
      throw unprocessable('too_few_categories', `Customers need at least ${MIN_VISIBLE_CATEGORIES} visible categories.`);
    }
    return result;
  });
}

const slugify = (name: string) =>
  name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'category';

export interface CategoryInput {
  name: string;
  description: string;
  keywords: string[];
  icon: string;
  isVisible: boolean;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return withShelfRules(async (c) => {
    const dup = await c.query('select 1 from categories where lower(name) = lower($1)', [input.name]);
    if (dup.rows[0]) throw conflict(`A category called "${input.name}" already exists`);
    const base = slugify(input.name);
    const taken = new Set((await c.query<{ id: string }>('select id from categories where id like $1', [`${base}%`])).rows.map((r) => r.id));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    await c.query(
      `insert into categories (id, name, description, keywords, icon, is_visible, sort_order)
       values ($1, $2, $3, $4, $5, $6, (select coalesce(max(sort_order), 0) + 1 from categories))`,
      [id, input.name, input.description, input.keywords, input.icon, input.isVisible],
    );
    return (await listCategories(c)).find((x) => x.id === id)!;
  });
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<Category> {
  return withShelfRules(async (c) => {
    if (patch.name) {
      const dup = await c.query('select 1 from categories where lower(name) = lower($1) and id <> $2', [patch.name, id]);
      if (dup.rows[0]) throw conflict(`A category called "${patch.name}" already exists`);
    }
    const { rowCount } = await c.query(
      `update categories set
         name = coalesce($2, name), description = coalesce($3, description), keywords = coalesce($4, keywords),
         icon = coalesce($5, icon), is_visible = coalesce($6, is_visible), updated_at = now(),
         -- New wording means the stored vector no longer describes the category.
         text_embedding = case when $2::text is not null or $3::text is not null or $4::text[] is not null
                               then null else text_embedding end
       where id = $1`,
      [id, patch.name ?? null, patch.description ?? null, patch.keywords ?? null, patch.icon ?? null, patch.isVisible ?? null],
    );
    if (!rowCount) throw notFound('Category not found');
    return (await listCategories(c)).find((x) => x.id === id)!;
  });
}

export async function reorderCategories(ids: string[]): Promise<Category[]> {
  return withShelfRules(async (c) => {
    const current = (await c.query<{ id: string }>('select id from categories')).rows.map((r) => r.id);
    if (ids.length !== current.length || new Set(ids).size !== ids.length || !current.every((id) => ids.includes(id))) {
      throw unprocessable('order_mismatch', 'The new order must list every category exactly once. Refresh and try again.');
    }
    await c.query(
      `update categories set sort_order = o.pos, updated_at = now()
         from unnest($1::text[]) with ordinality as o(id, pos) where categories.id = o.id`,
      [ids],
    );
    return listCategories(c);
  });
}

/** Removing a category moves its products and pending proposals to another one first. */
export async function deleteCategory(id: string, moveTo: string): Promise<{ moved: number }> {
  if (id === moveTo) throw unprocessable('same_category', 'Pick a different category to move the products to');
  return withShelfRules(async (c) => {
    const both = await c.query<{ id: string }>('select id from categories where id = any($1)', [[id, moveTo]]);
    if (!both.rows.some((r) => r.id === id)) throw notFound('Category not found');
    if (!both.rows.some((r) => r.id === moveTo)) throw unprocessable('unknown_category', 'The category to move products to does not exist');
    const moved = await c.query('update products set category_id = $2, updated_at = now() where category_id = $1', [id, moveTo]);
    await c.query('update product_submissions set category_id = $2 where category_id = $1', [id, moveTo]);
    await c.query('delete from categories where id = $1', [id]);
    return { moved: moved.rowCount ?? 0 };
  });
}

/** Embeds any category whose wording changed, or that was embedded with a different model. */
export async function ensureCategoryEmbeddings(db: Db = pool): Promise<number> {
  const { rows } = await db.query<{ id: string; name: string; description: string; keywords: string[] }>(
    `select id, name, description, keywords from categories
      where text_embedding is null or embedding_model is distinct from $1`,
    [currentTextModel()],
  );
  for (const c of rows) {
    const e = await embedText(categoryAnchorText(c));
    await db.query('update categories set text_embedding = $2::vector, embedding_model = $3 where id = $1', [
      c.id,
      toPgVector(e.vector),
      e.model,
    ]);
  }
  return rows.length;
}

export interface CategorySuggestion {
  productId: string;
  sku: string;
  name: string;
  currentCategoryId: string;
  suggestedCategoryId: string;
  /** How far ahead the suggestion is of the current category; 1 is about one extra keyword match. */
  margin: number;
  keywordHits: number;
  similarity: number | null;
  recommended: boolean;
}

const RECOMMEND_MARGIN = 1;

export async function categorySuggestions(db: Db = pool): Promise<{ scanned: number; suggestions: CategorySuggestion[] }> {
  await ensureCategoryEmbeddings(db);
  const categories = await db.query<{ id: string; keywords: string[] }>('select id, keywords from categories');
  // pgvector scores every product against every category in one pass (at most 12 per product).
  const { rows } = await db.query<{
    id: string; sku: string; name: string; description: string | null; categoryId: string; sims: Record<string, number>;
  }>(
    `select p.id, p.sku, p.name, p.description, p.category_id as "categoryId",
            coalesce((select jsonb_object_agg(c.id, round((1 - (p.text_embedding <=> c.text_embedding))::numeric, 4))
                        from categories c
                       where c.text_embedding is not null and c.embedding_model = p.embedding_model), '{}'::jsonb) as sims
       from products p
      where p.is_active
      order by p.name
      limit 5000`,
  );
  const suggestions: CategorySuggestion[] = [];
  for (const p of rows) {
    const sims = Object.fromEntries(Object.entries(p.sims).map(([k, v]) => [k, Number(v)]));
    const scored = scoreCategories(p, categories.rows, sims);
    const best = scored[0];
    if (!best || best.categoryId === p.categoryId) continue;
    const current = scored.find((s) => s.categoryId === p.categoryId);
    const margin = Math.round((best.score - (current?.score ?? 0)) * 100) / 100;
    suggestions.push({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      currentCategoryId: p.categoryId,
      suggestedCategoryId: best.categoryId,
      margin,
      keywordHits: best.keywordHits,
      similarity: best.similarity,
      recommended: margin >= RECOMMEND_MARGIN,
    });
  }
  suggestions.sort((a, b) => b.margin - a.margin);
  return { scanned: rows.length, suggestions };
}

export async function moveProducts(moves: { productId: string; categoryId: string }[]): Promise<number> {
  return withTransaction(async (c) => {
    const ids = [...new Set(moves.map((m) => m.categoryId))];
    const known = await c.query<{ id: string }>('select id from categories where id = any($1)', [ids]);
    if (known.rows.length !== ids.length) throw unprocessable('unknown_category', 'One of the target categories no longer exists. Refresh the suggestions.');
    const { rowCount } = await c.query(
      `update products set category_id = m.category_id, updated_at = now()
         from unnest($1::uuid[], $2::text[]) as m(id, category_id)
        where products.id = m.id`,
      [moves.map((m) => m.productId), moves.map((m) => m.categoryId)],
    );
    return rowCount ?? 0;
  });
}

// ---------------------------------------------------------------------------------------------
// Published storefront settings

export interface StorefrontVersion {
  id: number;
  note: string | null;
  publishedBy: string;
  restoredFrom: number | null;
  createdAt: string;
}

const VERSION_COLUMNS = `id::int, note, published_by as "publishedBy", restored_from::int as "restoredFrom", created_at as "createdAt"`;

/** The live settings. Anything that no longer fits the schema falls back to the defaults. */
export async function liveSettings(db: Db = pool): Promise<{ settings: StorefrontSettings; version: StorefrontVersion | null }> {
  const { rows } = await db.query<StorefrontVersion & { settings: unknown }>(
    `select ${VERSION_COLUMNS}, settings from storefront_versions order by id desc limit 1`,
  );
  const row = rows[0];
  if (!row) return { settings: DEFAULT_SETTINGS, version: null };
  const parsed = storefrontSettings.safeParse(row.settings);
  const { settings: _raw, ...version } = row;
  return { settings: parsed.success ? parsed.data : DEFAULT_SETTINGS, version };
}

export async function listVersions(db: Db = pool, limit = 20): Promise<StorefrontVersion[]> {
  const { rows } = await db.query<StorefrontVersion>(`select ${VERSION_COLUMNS} from storefront_versions order by id desc limit $1`, [limit]);
  return rows;
}

/** Banner buttons and home rows may only point at categories that exist. */
async function assertCategoriesExist(db: Db, settings: StorefrontSettings) {
  const referenced = new Set<string>();
  for (const s of settings.hero.slides) if (s.cta.kind === 'category') referenced.add(s.cta.categoryId);
  if (settings.announcement.cta?.kind === 'category') referenced.add(settings.announcement.cta.categoryId);
  for (const s of settings.home.sections) if (s.type === 'category' && s.categoryId) referenced.add(s.categoryId);
  if (referenced.size === 0) return;
  const { rows } = await db.query<{ id: string }>('select id from categories where id = any($1)', [[...referenced]]);
  const missing = [...referenced].filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) throw unprocessable('unknown_category', `These categories no longer exist: ${missing.join(', ')}`);
}

export async function publishSettings(
  settings: StorefrontSettings,
  note: string | null,
  publishedBy: string,
  restoredFrom: number | null = null,
): Promise<StorefrontVersion> {
  await assertCategoriesExist(pool, settings);
  const { rows } = await pool.query<StorefrontVersion>(
    `insert into storefront_versions (settings, note, published_by, restored_from)
     values ($1, $2, $3, $4) returning ${VERSION_COLUMNS}`,
    [JSON.stringify(settings), note, publishedBy, restoredFrom],
  );
  return rows[0]!;
}

export async function versionSettings(id: number): Promise<StorefrontSettings> {
  const { rows } = await pool.query<{ settings: unknown }>('select settings from storefront_versions where id = $1', [id]);
  if (!rows[0]) throw notFound('Version not found');
  const parsed = storefrontSettings.safeParse(rows[0].settings);
  if (!parsed.success) throw unprocessable('outdated_version', 'This version was saved in an older format and cannot be restored');
  return parsed.data;
}
