import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb } from './testdb.js';

let testDb: Awaited<ReturnType<typeof startTestDb>>;
let server: Server;
let base: string;
let db: typeof import('../src/db/pool.js');

const OWNER = 'studio-owner:admin';
const REGIONAL = 'studio-regional:customer';

async function call(as: string | null, method: string, url: string, body?: unknown) {
  const res = await fetch(`${base}/v1${url}`, {
    method,
    headers: {
      ...(as ? { Authorization: `Dev ${as}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  testDb = await startTestDb('spaceborn_studio', 54334, 'studio');
  db = await import('../src/db/pool.js');
  await (await import('../src/db/migrate.js')).migrate();
  await (await import('../src/db/seed.js')).seed();
  await db.pool.query(
    `insert into admin_members (email, is_owner, regions, note) values
       ('studio-owner@dev.local', true, null, 'test owner'),
       ('studio-regional@dev.local', false, '{kanpur}', 'regional')`,
  );
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  server?.close();
  await db?.pool.end();
  await testDb?.stop();
}, 60_000);

describe('category shelf', () => {
  it('is for global admins only', async () => {
    expect((await call(null, 'GET', '/admin/categories')).status).toBe(401);
    expect((await call('someone:customer', 'GET', '/admin/categories')).status).toBe(403);
    expect((await call(REGIONAL, 'GET', '/admin/categories')).status).toBe(403);
    expect((await call(REGIONAL, 'POST', '/admin/storefront/publish', { settings: {} })).status).toBe(403);
  });

  it('seeds the shelf and files 3D printers under 3D Printing & CNC', async () => {
    const res = await call(OWNER, 'GET', '/admin/categories');
    expect(res.status).toBe(200);
    expect(res.body.limits).toEqual({ minVisible: 5, max: 12 });
    const ids = res.body.categories.map((c: { id: string }) => c.id);
    expect(ids).toContain('3d-printing');
    expect(res.body.categories.length).toBeGreaterThanOrEqual(5);

    const { rows } = await db.pool.query<{ name: string; category_id: string }>(
      `select name, category_id from products where name ~* '(3d printer|pla filament)'`,
    );
    for (const p of rows) expect(p.category_id, p.name).toBe('3d-printing');
  });

  it('keeps between 5 visible and 12 total categories', async () => {
    const { body } = await call(OWNER, 'GET', '/admin/categories');
    const existing: number = body.categories.length;

    const created: string[] = [];
    for (let i = existing; i < 12; i++) {
      const res = await call(OWNER, 'POST', '/admin/categories', { name: `Extra shelf ${i}`, keywords: [`extra${i}`] });
      expect(res.status).toBe(201);
      created.push(res.body.category.id);
    }
    const thirteenth = await call(OWNER, 'POST', '/admin/categories', { name: 'One too many' });
    expect(thirteenth.status).toBe(422);
    expect(thirteenth.body.error.code).toBe('too_many_categories');

    const dup = await call(OWNER, 'POST', '/admin/categories', { name: 'extra SHELF 11' });
    expect([409, 422]).toContain(dup.status);

    for (const id of created) expect((await call(OWNER, 'DELETE', `/admin/categories/${id}?moveTo=components`)).status).toBe(200);

    // Hide categories until only five are visible; the sixth hide is refused and nothing changes.
    const list = (await call(OWNER, 'GET', '/admin/categories')).body.categories as { id: string; isVisible: boolean }[];
    const visible = list.filter((c) => c.isVisible);
    const toHide = visible.slice(5);
    for (const c of toHide) expect((await call(OWNER, 'PATCH', `/admin/categories/${c.id}`, { isVisible: false })).status).toBe(200);
    const tooFew = await call(OWNER, 'PATCH', `/admin/categories/${visible[0]!.id}`, { isVisible: false });
    expect(tooFew.status).toBe(422);
    expect(tooFew.body.error.code).toBe('too_few_categories');

    const publicConfig = await call(null, 'GET', '/storefront');
    expect(publicConfig.body.categories.map((c: { id: string }) => c.id)).toEqual(visible.slice(0, 5).map((c) => c.id));

    for (const c of toHide) await call(OWNER, 'PATCH', `/admin/categories/${c.id}`, { isVisible: true });
  });

  it('moves products to another shelf before removing one', async () => {
    const created = await call(OWNER, 'POST', '/admin/categories', { name: 'Drones & FPV', keywords: ['drone', 'fpv'], icon: 'plane' });
    expect(created.status).toBe(201);
    const id = created.body.category.id as string;
    expect(id).toBe('drones-and-fpv');

    const { rows } = await db.pool.query<{ id: string }>(`select id from products where category_id = 'sensors' limit 2`);
    const moved = await call(OWNER, 'POST', '/admin/categories/suggestions/apply', {
      moves: rows.map((r) => ({ productId: r.id, categoryId: id })),
    });
    expect(moved.body.moved).toBe(rows.length);

    expect((await call(OWNER, 'DELETE', `/admin/categories/${id}?moveTo=${id}`)).status).toBe(422);
    expect((await call(OWNER, 'DELETE', `/admin/categories/${id}?moveTo=nope`)).status).toBe(422);
    const removed = await call(OWNER, 'DELETE', `/admin/categories/${id}?moveTo=sensors`);
    expect(removed.status).toBe(200);
    expect(removed.body.moved).toBe(rows.length);
    const back = await db.pool.query('select count(*)::int as n from products where id = any($1) and category_id = $2', [rows.map((r) => r.id), 'sensors']);
    expect(back.rows[0].n).toBe(rows.length);
  });

  it('reorders only when every category is listed once', async () => {
    const list = (await call(OWNER, 'GET', '/admin/categories')).body.categories as { id: string }[];
    const reversed = list.map((c) => c.id).reverse();
    expect((await call(OWNER, 'PUT', '/admin/categories/order', { ids: reversed.slice(1) })).status).toBe(422);
    const res = await call(OWNER, 'PUT', '/admin/categories/order', { ids: reversed });
    expect(res.status).toBe(200);
    expect(res.body.categories.map((c: { id: string }) => c.id)).toEqual(reversed);
    await call(OWNER, 'PUT', '/admin/categories/order', { ids: list.map((c) => c.id) });
  });

  it('suggests a better shelf for a misfiled product', async () => {
    const { rows } = await db.pool.query<{ id: string }>(
      `select id from products where category_id = '3d-printing' and name ~* '3d printer' limit 1`,
    );
    const printer = rows[0]!.id;
    await db.pool.query(`update products set category_id = 'power' where id = $1`, [printer]);

    const scan = await call(OWNER, 'GET', '/admin/categories/suggestions');
    expect(scan.status).toBe(200);
    expect(scan.body.scanned).toBeGreaterThan(0);
    const hit = scan.body.suggestions.find((s: { productId: string }) => s.productId === printer);
    expect(hit).toMatchObject({ currentCategoryId: 'power', suggestedCategoryId: '3d-printing', recommended: true });

    await call(OWNER, 'POST', '/admin/categories/suggestions/apply', { moves: [{ productId: printer, categoryId: '3d-printing' }] });
    const after = await call(OWNER, 'GET', '/admin/categories/suggestions');
    expect(after.body.suggestions.some((s: { productId: string }) => s.productId === printer)).toBe(false);
  });
});

describe('storefront look', () => {
  it('serves the built-in design until something is published', async () => {
    const res = await call(null, 'GET', '/storefront');
    expect(res.status).toBe(200);
    expect(res.body.version).toBeNull();
    expect(res.body.settings.hero.slides.length).toBeGreaterThan(0);
  });

  it('publishes, validates and restores versions', async () => {
    const live = (await call(OWNER, 'GET', '/admin/storefront')).body;
    const settings = structuredClone(live.settings);

    const tooLight = structuredClone(settings);
    tooLight.theme.accent = '#ffee88';
    expect((await call(OWNER, 'POST', '/admin/storefront/publish', { settings: tooLight })).status).toBe(400);

    const offsite = structuredClone(settings);
    offsite.hero.slides[0].imageUrl = 'http://example.com/x.png';
    expect((await call(OWNER, 'POST', '/admin/storefront/publish', { settings: offsite })).status).toBe(400);

    const ghost = structuredClone(settings);
    ghost.home.sections.push({ id: 'ghost', type: 'category', categoryId: 'no-such-shelf', title: 'Ghost', subtitle: '', visible: true });
    expect((await call(OWNER, 'POST', '/admin/storefront/publish', { settings: ghost })).status).toBe(422);

    const first = structuredClone(settings);
    first.theme = { preset: 'ocean', accent: '#1d4ed8' };
    first.announcement = { enabled: true, text: 'Diwali week: free delivery', cta: { kind: 'category', categoryId: '3d-printing' } };
    const v1 = await call(OWNER, 'POST', '/admin/storefront/publish', { settings: first, note: 'Diwali' });
    expect(v1.status).toBe(201);

    const second = structuredClone(first);
    second.announcement.enabled = false;
    const v2 = await call(OWNER, 'POST', '/admin/storefront/publish', { settings: second });
    expect(v2.status).toBe(201);

    let pub = await call(null, 'GET', '/storefront');
    expect(pub.body.version).toBe(v2.body.version.id);
    expect(pub.body.settings.announcement.enabled).toBe(false);

    const restored = await call(OWNER, 'POST', `/admin/storefront/versions/${v1.body.version.id}/restore`);
    expect(restored.status).toBe(201);
    expect(restored.body.version.restoredFrom).toBe(v1.body.version.id);

    pub = await call(null, 'GET', '/storefront');
    expect(pub.body.version).toBe(restored.body.version.id);
    expect(pub.body.settings.announcement).toMatchObject({ enabled: true, text: 'Diwali week: free delivery' });
    expect(pub.body.settings.theme).toEqual({ preset: 'ocean', accent: '#1d4ed8' });

    const history = (await call(OWNER, 'GET', '/admin/storefront')).body;
    expect(history.liveVersion).toBe(restored.body.version.id);
    expect(history.versions.map((v: { id: number }) => v.id).slice(0, 3)).toEqual([restored.body.version.id, v2.body.version.id, v1.body.version.id]);
    expect((await call(OWNER, 'POST', '/admin/storefront/versions/99999/restore')).status).toBe(404);
  });
});
