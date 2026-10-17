import { Router } from 'express';
import { z } from 'zod';
import { adminScope, requireGlobalAdmin } from '../auth.js';
import { audit } from '../admin/team.js';
import { bumpCatalog } from '../cache.js';
import { parse } from '../errors.js';
import { CATEGORY_ICONS } from '../catalog/categories.js';
import {
  categorySuggestions, createCategory, deleteCategory, listCategories, listVersions, liveSettings, MAX_CATEGORIES,
  MIN_VISIBLE_CATEGORIES, moveProducts, publishSettings, reorderCategories, updateCategory, versionSettings,
} from '../storefront/service.js';
import { storefrontSettings } from '../storefront/settings.js';
import { uuid } from './schemas.js';

/** Storefront Studio: the category shelf and the published look. Company-wide, so global admins only.
 * Mounted inside the admin router, which has already checked the caller is an admin. */
export const storefrontAdminRouter = Router();

const categoryId = z.string().trim().regex(/^[a-z0-9-]{1,60}$/);
const categoryBody = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(300).default(''),
  keywords: z
    .array(z.string().trim().toLowerCase().min(2).max(40))
    .max(40)
    .default([])
    .transform((list) => [...new Set(list)]),
  icon: z.enum(CATEGORY_ICONS).default('box'),
  isVisible: z.boolean().default(true),
});

storefrontAdminRouter.get('/categories', requireGlobalAdmin, async (_req, res) => {
  res.json({ categories: await listCategories(), limits: { minVisible: MIN_VISIBLE_CATEGORIES, max: MAX_CATEGORIES } });
});

storefrontAdminRouter.post('/categories', requireGlobalAdmin, async (req, res) => {
  const category = await createCategory(parse(categoryBody, req.body));
  await bumpCatalog();
  await audit(req, 'category.create', { type: 'category', id: category.id }, { name: category.name });
  res.status(201).json({ category });
});

storefrontAdminRouter.put('/categories/order', requireGlobalAdmin, async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(categoryId).min(1).max(MAX_CATEGORIES) }), req.body);
  const categories = await reorderCategories(ids);
  await bumpCatalog();
  await audit(req, 'category.reorder', { type: 'category', id: null }, { ids });
  res.json({ categories });
});

storefrontAdminRouter.patch('/categories/:id', requireGlobalAdmin, async (req, res) => {
  const id = parse(categoryId, req.params.id);
  const patch = parse(categoryBody.partial(), req.body);
  const category = await updateCategory(id, patch);
  await bumpCatalog();
  await audit(req, 'category.update', { type: 'category', id }, { changed: Object.keys(patch) });
  res.json({ category });
});

storefrontAdminRouter.delete('/categories/:id', requireGlobalAdmin, async (req, res) => {
  const id = parse(categoryId, req.params.id);
  const { moveTo } = parse(z.object({ moveTo: categoryId }), req.query);
  const result = await deleteCategory(id, moveTo);
  await bumpCatalog();
  await audit(req, 'category.delete', { type: 'category', id }, { moveTo, moved: result.moved });
  res.json(result);
});

storefrontAdminRouter.get('/categories/suggestions', requireGlobalAdmin, async (_req, res) => {
  res.json(await categorySuggestions());
});

storefrontAdminRouter.post('/categories/suggestions/apply', requireGlobalAdmin, async (req, res) => {
  const { moves } = parse(
    z.object({ moves: z.array(z.object({ productId: uuid, categoryId })).min(1).max(500) }),
    req.body,
  );
  const moved = await moveProducts(moves);
  await bumpCatalog();
  await audit(req, 'category.recategorise', { type: 'product', id: null }, { moved, requested: moves.length });
  res.json({ moved });
});

storefrontAdminRouter.get('/storefront', requireGlobalAdmin, async (_req, res) => {
  const [live, versions] = await Promise.all([liveSettings(), listVersions()]);
  res.json({ settings: live.settings, liveVersion: live.version?.id ?? null, versions });
});

storefrontAdminRouter.post('/storefront/publish', requireGlobalAdmin, async (req, res) => {
  const body = parse(z.object({ settings: storefrontSettings, note: z.string().trim().max(200).optional() }), req.body);
  const version = await publishSettings(body.settings, body.note || null, adminScope(req).email);
  await bumpCatalog();
  await audit(req, 'storefront.publish', { type: 'storefront', id: String(version.id) }, { note: version.note });
  res.status(201).json({ version });
});

storefrontAdminRouter.post('/storefront/versions/:id/restore', requireGlobalAdmin, async (req, res) => {
  const id = parse(z.coerce.number().int().positive(), req.params.id);
  const settings = await versionSettings(id);
  const version = await publishSettings(settings, `Restored version ${id}`, adminScope(req).email, id);
  await bumpCatalog();
  await audit(req, 'storefront.restore', { type: 'storefront', id: String(version.id) }, { restoredFrom: id });
  res.status(201).json({ version, settings });
});
