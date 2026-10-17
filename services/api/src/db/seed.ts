import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_SEEDS, scoreCategories } from '../catalog/categories.js';
import { backfillProductEmbeddings } from '../catalog/search.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import catalog from './seed-catalog.json' with { type: 'json' };
import { pool, withTransaction } from './pool.js';

// The catalog file's coarse labels, used only when a title matches no category keyword.
const FALLBACK_CATEGORY: Record<string, string> = {
  Controllers: 'dev-boards',
  Sensors: 'sensors',
  Motors: 'motors',
  Batteries: 'power',
  Accessories: 'accessories',
  Structural: 'mechanical',
};

function seedCategoryId(item: { name: string; description?: string | null; category: string }): string {
  const best = scoreCategories({ name: item.name, description: item.description ?? null }, CATEGORY_SEEDS, {})[0];
  return best && best.keywordHits > 0 ? best.categoryId : (FALLBACK_CATEGORY[item.category] ?? 'accessories');
}

const DEMO_STORES = [
  { owner: 'seed-vendor-kanpur', name: 'Kanpur Robotics Hub', address: '14/116 Mall Road', city: 'Kanpur', pincode: '208001', lat: 26.4499, lng: 80.3319 },
  { owner: 'seed-vendor-bengaluru', name: 'Koramangala Electronics', address: '80 Feet Road, Koramangala 4th Block', city: 'Bengaluru', pincode: '560034', lat: 12.9352, lng: 77.6245 },
  { owner: 'seed-vendor-chennai', name: 'Chennai Maker Labs', address: '22 NSC Bose Road, Parrys Corner', city: 'Chennai', pincode: '600001', lat: 13.0827, lng: 80.2707 },
  { owner: 'seed-vendor-pune', name: 'Pune Maker Store', address: '5 MG Road, Camp', city: 'Pune', pincode: '411001', lat: 18.5204, lng: 73.8567 },
];

export async function seed() {
  if (config.isProd && process.env.FORCE_SEED !== 'true') throw new Error('Refusing to seed demo data in production');

  await withTransaction(async (c) => {
    // Existing categories are left alone: admins may have renamed or reordered them.
    for (const [i, cat] of CATEGORY_SEEDS.entries()) {
      await c.query(
        `insert into categories (id, name, sort_order, description, keywords, icon) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing`,
        [cat.id, cat.name, i + 1, cat.description, cat.keywords, cat.icon],
      );
    }

    for (const item of catalog) {
      const category = { id: seedCategoryId(item) };
      const badges = ['MOT-N20-12V-300E', 'MCU-ESP32-32D-MOD', 'DEV-ARD-UNO-R3', 'SBC-RPI-5-8GB', 'SEN-LIDAR-TOF-M8'].includes(item.sku)
        ? ['our_pick']
        : [];
      await c.query(
        `insert into products (sku, name, category_id, description, image_url, mrp, badges)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (sku) do update set image_url = excluded.image_url, badges = excluded.badges`,
        [item.sku, item.name, category.id, item.description, item.image, Math.ceil(item.price * 1.2), badges],
      );
    }

    // Only the curated catalog. Vendor-approved products must stay stocked at the store that submitted them.
    const { rows: products } = await c.query<{ id: string; sku: string; mrp: number }>(
      'select id, sku, mrp from products where sku = any($1::text[])',
      [catalog.map((item) => item.sku)],
    );
    for (const [storeIndex, store] of DEMO_STORES.entries()) {
      await c.query(
        `insert into users (id, email, full_name, role) values ($1, $2, $3, 'vendor') on conflict (id) do nothing`,
        [store.owner, `${store.owner}@seed.local`, store.name],
      );
      const { rows } = await c.query<{ id: string }>(
        `insert into stores (owner_id, name, phone, address_line, city, pincode, latitude, longitude, status, is_online, delivery_radius_km)
         values ($1, $2, '9876543210', $3, $4, $5, $6, $7, 'approved', true, 8)
         on conflict (owner_id) do update set name = excluded.name, address_line = excluded.address_line
         returning id`,
        [store.owner, store.name, store.address, store.city, store.pincode, store.lat, store.lng],
      );
      const storeId = rows[0]!.id;
      for (const [i, product] of products.entries()) {
        const price = Math.max(1, Math.round(product.mrp * (0.8 + ((i + storeIndex) % 4) * 0.03)));
        const stock = 5 + ((i * 7 + storeIndex * 11) % 40);
        await c.query(
          `insert into inventory (store_id, product_id, price, stock) values ($1, $2, $3, $4)
           on conflict (store_id, product_id) do nothing`,
          [storeId, product.id, price, stock],
        );
      }

      // Seed approved 3D Printing and CNC services for local makers
      await c.query(
        `insert into service_listings (store_id, kind, title, description, materials, max_x_mm, max_y_mm, max_z_mm, starting_price, turnaround_hours, status, is_active)
         values
           ($1, '3d_printing', $2, 'High precision FDM 3D printing for prototypes, enclosures, and custom brackets.', array['PLA', 'PETG', 'ABS', 'TPU'], 250, 250, 300, 149, 12, 'approved', true),
           ($1, 'cnc', $3, 'Precision 3-axis CNC routing and milling for metal plates and custom panels.', array['Aluminium 6061', 'Acrylic', 'Delrin', 'MDF'], 600, 400, 80, 499, 24, 'approved', true)
         on conflict (store_id, kind) do nothing`,
        [storeId, `${store.city} Precision 3D Printing`, `${store.city} Rapid CNC Machining`],
      );
    }
  });
  // Customer search ranks by meaning, so a fresh stack needs product vectors before the first search.
  const embedded = await backfillProductEmbeddings(pool, catalog.length + 50);
  logger.info({ products: catalog.length, stores: DEMO_STORES.length, embedded }, 'seed complete');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      logger.error({ err }, 'seed failed');
      process.exit(1);
    });
}
