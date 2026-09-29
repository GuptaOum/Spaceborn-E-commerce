import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { logger } from '../logger.js';
import catalog from './seed-catalog.json' with { type: 'json' };
import { pool, withTransaction } from './pool.js';

const CATEGORIES: Record<string, { id: string; name: string; sort: number }> = {
  Controllers: { id: 'dev-boards', name: 'Dev Boards & MCUs', sort: 1 },
  Sensors: { id: 'sensors', name: 'Sensors & Modules', sort: 2 },
  Motors: { id: 'motors', name: 'Motors & Drivers', sort: 3 },
  Batteries: { id: 'power', name: 'Batteries & Power', sort: 4 },
  Accessories: { id: 'accessories', name: 'Tools & Accessories', sort: 5 },
  Structural: { id: 'mechanical', name: 'Mechanical & Frames', sort: 6 },
};

const DEMO_STORES = [
  { owner: 'seed-vendor-kanpur', name: 'Kanpur Robotics Hub', city: 'Kanpur', pincode: '208001', lat: 26.4499, lng: 80.3319 },
  { owner: 'seed-vendor-bengaluru', name: 'Koramangala Electronics', city: 'Bengaluru', pincode: '560034', lat: 12.9352, lng: 77.6245 },
  { owner: 'seed-vendor-pune', name: 'Pune Maker Store', city: 'Pune', pincode: '411001', lat: 18.5204, lng: 73.8567 },
];

export async function seed() {
  if (config.isProd) throw new Error('Refusing to seed demo data in production');

  await withTransaction(async (c) => {
    for (const cat of Object.values(CATEGORIES)) {
      await c.query(
        'insert into categories (id, name, sort_order) values ($1, $2, $3) on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order',
        [cat.id, cat.name, cat.sort],
      );
    }

    for (const item of catalog) {
      const category = CATEGORIES[item.category] ?? CATEGORIES.Accessories!;
      await c.query(
        `insert into products (sku, name, category_id, description, image_url, mrp, specs)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (sku) do nothing`,
        [item.sku, item.name, category.id, item.description, item.image, Math.ceil(item.price * 1.2),
          JSON.stringify({})],
      );
    }

    const { rows: products } = await c.query<{ id: string; sku: string; mrp: number }>('select id, sku, mrp from products');
    for (const [storeIndex, store] of DEMO_STORES.entries()) {
      await c.query(
        `insert into users (id, email, full_name, role) values ($1, $2, $3, 'vendor') on conflict (id) do nothing`,
        [store.owner, `${store.owner}@seed.local`, store.name],
      );
      const { rows } = await c.query<{ id: string }>(
        `insert into stores (owner_id, name, phone, address_line, city, pincode, latitude, longitude, status, is_online, delivery_radius_km)
         values ($1, $2, '9876543210', $3, $4, $5, $6, $7, 'approved', true, 8)
         on conflict (owner_id) do update set name = excluded.name
         returning id`,
        [store.owner, store.name, `${store.name}, Main Road`, store.city, store.pincode, store.lat, store.lng],
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
    }
  });
  logger.info({ products: catalog.length, stores: DEMO_STORES.length }, 'seed complete');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      logger.error({ err }, 'seed failed');
      process.exit(1);
    });
}
