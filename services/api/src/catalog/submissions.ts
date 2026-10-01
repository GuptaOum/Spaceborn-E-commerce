import crypto from 'node:crypto';
import path from 'node:path';
import type { Response } from 'express';
import sharp from 'sharp';
import { pool, withTransaction, type Db } from '../db/pool.js';
import { conflict, notFound, unprocessable } from '../errors.js';
import { logger } from '../logger.js';
import { storage } from '../storage.js';
import { cosine, embedImage, embedText, fromPgVector, toPgVector } from './embeddings.js';

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const DUPLICATE_SCORE = 0.82;
const MIN_SCORE = 0.35;
const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function imageContentType(key: string) {
  return IMAGE_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
}

/** Longest side after normalisation. Bedrock Titan rejects large phone photos ("exceeds max pixels"). */
export const IMAGE_MAX_SIDE = 1280;

/**
 * Decode, auto-rotate (EXIF), downscale and re-encode as JPEG. This also strips metadata and
 * guarantees the bytes really are an image, whatever the extension claimed.
 */
export async function normaliseProductImage(body: Buffer): Promise<Buffer> {
  try {
    return await sharp(body, { failOn: 'error', animated: false })
      .rotate()
      .resize({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    logger.warn({ err }, 'product image could not be decoded');
    throw unprocessable('image_unreadable', 'That file is not a readable photo. Try a JPG or PNG.');
  }
}

export async function saveProductImage(storeId: string, rawName: string, body: Buffer) {
  const base = path.basename(rawName.replace(/\\/g, '/')).normalize('NFKC');
  const ext = path.extname(base).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) {
    throw unprocessable('file_type', `Product photos must be ${IMAGE_EXTENSIONS.join(', ')}`);
  }
  if (body.length < 32) throw unprocessable('file_empty', 'The image is empty');
  const normalised = await normaliseProductImage(body);
  const key = `submissions/${storeId}/${crypto.randomUUID()}.jpg`;
  await storage.put(key, normalised);
  return { imageKey: key, bytes: normalised.length };
}

async function readStored(key: string): Promise<Buffer> {
  const stream = await storage.get(key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function ownImageKey(storeId: string, imageKey: string) {
  const prefix = `submissions/${storeId}/`;
  if (!imageKey.startsWith(prefix) || imageKey.includes('..') || imageKey.includes('\\')) {
    throw unprocessable('image_invalid', 'Upload the product photo again');
  }
}

export interface SubmissionInput {
  name: string;
  description: string;
  categoryId: string;
  brand?: string;
  mrp: number;
  price: number;
  stock: number;
  imageKey: string;
}

const COLUMNS = `
  s.id, s.store_id as "storeId", s.name, s.description, s.category_id as "categoryId", s.brand,
  s.mrp, s.price, s.stock, s.status, s.review_note as "reviewNote", s.product_id as "productId",
  s.image_key as "imageKey", s.created_at as "createdAt", s.updated_at as "updatedAt"`;

function present<T extends { mrp: number; price: number; imageKey?: string | null }>(row: T) {
  const { imageKey, ...rest } = row;
  return { ...rest, mrp: Number(row.mrp), price: Number(row.price), hasImage: Boolean(imageKey) };
}

async function requireCategory(db: Db, categoryId: string) {
  const { rows } = await db.query('select 1 from categories where id = $1', [categoryId]);
  if (!rows[0]) throw unprocessable('unknown_category', 'Pick a category from the list');
}

async function vectorsFor(input: SubmissionInput) {
  const text = await embedText(`${input.name}\n${input.description}`);
  let image: Awaited<ReturnType<typeof embedImage>> = null;
  try {
    image = await embedImage(await readStored(input.imageKey));
  } catch (err) {
    logger.warn({ err, key: input.imageKey }, 'could not read product image for embedding');
    throw unprocessable('image_missing', 'Upload the product photo again');
  }
  return { text, image };
}

export async function createSubmission(storeId: string, input: SubmissionInput) {
  if (input.price > input.mrp) throw unprocessable('price_above_mrp', 'Price cannot exceed the MRP');
  ownImageKey(storeId, input.imageKey);
  await requireCategory(pool, input.categoryId);
  const { text, image } = await vectorsFor(input);
  const { rows } = await pool.query(
    `insert into product_submissions as s
       (store_id, name, description, category_id, brand, mrp, price, stock, image_key,
        text_embedding, embedding_model, image_embedding, image_embedding_model)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12::vector, $13)
     returning ${COLUMNS}`,
    [storeId, input.name, input.description, input.categoryId, input.brand ?? null, input.mrp, input.price,
      input.stock, input.imageKey, toPgVector(text.vector), text.model,
      image ? toPgVector(image.vector) : null, image?.model ?? null],
  );
  return present(rows[0]);
}

export async function updateSubmission(storeId: string, id: string, input: SubmissionInput) {
  if (input.price > input.mrp) throw unprocessable('price_above_mrp', 'Price cannot exceed the MRP');
  ownImageKey(storeId, input.imageKey);
  await requireCategory(pool, input.categoryId);
  const { text, image } = await vectorsFor(input);
  const { rows } = await pool.query(
    `update product_submissions s set
       name = $3, description = $4, category_id = $5, brand = $6, mrp = $7, price = $8, stock = $9,
       image_key = $10, text_embedding = $11::vector, embedding_model = $12,
       image_embedding = $13::vector, image_embedding_model = $14, review_note = null
     where s.id = $1 and s.store_id = $2 and s.status = 'pending'
     returning ${COLUMNS}`,
    [id, storeId, input.name, input.description, input.categoryId, input.brand ?? null, input.mrp, input.price,
      input.stock, input.imageKey, toPgVector(text.vector), text.model,
      image ? toPgVector(image.vector) : null, image?.model ?? null],
  );
  if (!rows[0]) throw notFound('Submission not found');
  return present(rows[0]);
}

export async function listStoreSubmissions(storeId: string) {
  const { rows } = await pool.query(`select ${COLUMNS} from product_submissions s where s.store_id = $1 order by s.created_at desc`, [
    storeId,
  ]);
  return rows.map(present);
}

export async function deleteSubmission(storeId: string, id: string) {
  const { rowCount } = await pool.query(
    `delete from product_submissions where id = $1 and store_id = $2 and status = 'pending'`,
    [id, storeId],
  );
  if (!rowCount) throw notFound('Submission not found');
}

/** Cities are a lower-cased admin region list; null means no regional restriction. */
export type CityScope = string[] | null;
const CITY_FILTER = `($CITIES::text[] is null or lower(btrim(st.city)) = any($CITIES))`;
const cityFilter = (param: number) => CITY_FILTER.replaceAll('$CITIES', `$${param}`);

export async function submissionImage(id: string, storeId: string | null, cities: CityScope = null) {
  const { rows } = await pool.query<{ image_key: string }>(
    `select s.image_key from product_submissions s join stores st on st.id = s.store_id
      where s.id = $1 and ($2::uuid is null or s.store_id = $2) and ${cityFilter(3)}`,
    [id, storeId, cities],
  );
  if (!rows[0]) throw notFound('Image not found');
  return { key: rows[0].image_key, stream: await storage.get(rows[0].image_key) };
}

export interface SimilarMatch {
  kind: 'catalog' | 'submission';
  id: string;
  name: string;
  sku: string | null;
  city: string | null;
  score: number;
  textScore: number;
  imageScore: number | null;
  likelyDuplicate: boolean;
}

interface ScoredRow {
  id: string;
  name: string;
  description: string;
  sku?: string | null;
  city?: string | null;
  nameSim?: number | string | null;
  textScore?: number | string | null;
  imageScore?: number | string | null;
  text_embedding: unknown;
  embedding_model: string | null;
  image_embedding: unknown;
  image_embedding_model: string | null;
  kind: 'catalog' | 'submission';
}

function scoreRow(
  row: ScoredRow,
  text: { vector: number[]; model: string },
  image: { vector: number[]; model: string } | null,
): SimilarMatch | null {
  const storedText = row.embedding_model === text.model ? fromPgVector(row.text_embedding) : null;
  const textScore = row.textScore != null ? Number(row.textScore) : storedText ? cosine(text.vector, storedText) : 0;
  const storedImage = image && row.image_embedding_model === image.model ? fromPgVector(row.image_embedding) : null;
  const imageScore = row.imageScore != null ? Number(row.imageScore) : storedImage ? cosine(image!.vector, storedImage) : null;
  const nameSim = Number(row.nameSim ?? 0);
  const score = Math.max(textScore, imageScore ?? 0, nameSim);
  if (score < MIN_SCORE) return null;
  return {
    kind: row.kind,
    id: row.id,
    name: row.name,
    sku: row.sku ?? null,
    city: row.city ?? null,
    score: Math.round(score * 1000) / 1000,
    textScore: Math.round(textScore * 1000) / 1000,
    imageScore: imageScore == null ? null : Math.round(imageScore * 1000) / 1000,
    likelyDuplicate: score >= DUPLICATE_SCORE || nameSim >= 0.85,
  };
}

export async function findSimilar(db: Db, submissionId: string): Promise<SimilarMatch[]> {
  const { rows } = await db.query(
    `select name, description, text_embedding, embedding_model, image_embedding, image_embedding_model
       from product_submissions where id = $1`,
    [submissionId],
  );
  const sub = rows[0];
  if (!sub) throw notFound('Submission not found');
  let textVec = sub.embedding_model ? fromPgVector(sub.text_embedding) : null;
  let textModel = sub.embedding_model as string | null;
  if (!textVec || !textModel) {
    const embedded = await embedText(`${sub.name}\n${sub.description}`);
    textVec = embedded.vector;
    textModel = embedded.model;
  }
  const imageVec = fromPgVector(sub.image_embedding);
  const text = { vector: textVec, model: textModel };
  const image = imageVec && sub.image_embedding_model ? { vector: imageVec, model: sub.image_embedding_model as string } : null;

  const vector = toPgVector(text.vector);
  const imageVector = image ? toPgVector(image.vector) : null;
  // `<=>` is pgvector cosine distance, so the HNSW indexes on text_embedding / image_embedding do the ranking.
  const byVector = await db.query<ScoredRow>(
    `select p.id, p.sku, p.name, p.description, null::text as city, 'catalog'::text as kind,
            similarity(p.name, $2) as "nameSim",
            1 - (p.text_embedding <=> $1::vector) as "textScore",
            p.text_embedding, p.embedding_model, p.image_embedding, p.image_embedding_model
       from products p
      where p.is_active and p.embedding_model = $3 and p.text_embedding is not null
      order by p.text_embedding <=> $1::vector
      limit 8`,
    [vector, sub.name, text.model],
  );
  const byTitle = await db.query<ScoredRow>(
    `select p.id, p.sku, p.name, p.description, null::text as city, 'catalog'::text as kind,
            similarity(p.name, $1) as "nameSim",
            p.text_embedding, p.embedding_model, p.image_embedding, p.image_embedding_model
       from products p
      where p.is_active
      order by similarity(p.name, $1) desc
      limit 8`,
    [sub.name],
  );
  const pendingByVector = await db.query<ScoredRow>(
    `select s.id, null::text as sku, s.name, s.description, st.city, 'submission'::text as kind,
            similarity(s.name, $3) as "nameSim",
            1 - (s.text_embedding <=> $1::vector) as "textScore",
            s.text_embedding, s.embedding_model, s.image_embedding, s.image_embedding_model
       from product_submissions s join stores st on st.id = s.store_id
      where s.status = 'pending' and s.id <> $2 and s.embedding_model = $4 and s.text_embedding is not null
      order by s.text_embedding <=> $1::vector
      limit 8`,
    [vector, submissionId, sub.name, text.model],
  );
  const pendingByTitle = await db.query<ScoredRow>(
    `select s.id, null::text as sku, s.name, s.description, st.city, 'submission'::text as kind,
            similarity(s.name, $1) as "nameSim",
            s.text_embedding, s.embedding_model, s.image_embedding, s.image_embedding_model
       from product_submissions s join stores st on st.id = s.store_id
      where s.status = 'pending' and s.id <> $2
      order by similarity(s.name, $1) desc
      limit 8`,
    [sub.name, submissionId],
  );
  let byImage: { rows: ScoredRow[] } = { rows: [] };
  let pendingByImage: { rows: ScoredRow[] } = { rows: [] };
  if (image && imageVector) {
    byImage = await db.query<ScoredRow>(
      `select p.id, p.sku, p.name, p.description, null::text as city, 'catalog'::text as kind,
              similarity(p.name, $2) as "nameSim",
              1 - (p.image_embedding <=> $1::vector) as "imageScore",
              p.text_embedding, p.embedding_model, p.image_embedding, p.image_embedding_model
         from products p
        where p.is_active and p.image_embedding_model = $3 and p.image_embedding is not null
        order by p.image_embedding <=> $1::vector
        limit 8`,
      [imageVector, sub.name, image.model],
    );
    pendingByImage = await db.query<ScoredRow>(
      `select s.id, null::text as sku, s.name, s.description, st.city, 'submission'::text as kind,
              similarity(s.name, $3) as "nameSim",
              1 - (s.image_embedding <=> $1::vector) as "imageScore",
              s.text_embedding, s.embedding_model, s.image_embedding, s.image_embedding_model
         from product_submissions s join stores st on st.id = s.store_id
        where s.status = 'pending' and s.id <> $2 and s.image_embedding_model = $4 and s.image_embedding is not null
        order by s.image_embedding <=> $1::vector
        limit 8`,
      [imageVector, submissionId, sub.name, image.model],
    );
  }

  const merged = new Map<string, ScoredRow>();
  for (const row of [...byVector.rows, ...byTitle.rows, ...pendingByVector.rows, ...pendingByTitle.rows, ...byImage.rows, ...pendingByImage.rows]) {
    const key = `${row.kind}:${row.id}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, row);
      continue;
    }
    merged.set(key, {
      ...prev,
      nameSim: Math.max(Number(prev.nameSim ?? 0), Number(row.nameSim ?? 0)),
      textScore: prev.textScore ?? row.textScore,
      imageScore: prev.imageScore ?? row.imageScore,
      text_embedding: prev.text_embedding ?? row.text_embedding,
      embedding_model: prev.embedding_model ?? row.embedding_model,
    });
  }
  // Seeded products have no vector yet. Embed the closest titles so the next review hits the HNSW index.
  const candidates = [...merged.values()];
  let embedded = 0;
  for (const row of candidates) {
    if (embedded >= 8) break;
    if (row.embedding_model === text.model && fromPgVector(row.text_embedding)) continue;
    const vector = await embedText(`${row.name}\n${row.description ?? ''}`);
    if (vector.model !== text.model) continue;
    row.text_embedding = vector.vector;
    row.embedding_model = vector.model;
    embedded += 1;
    if (row.kind === 'catalog') {
      await db.query(
        `update products set text_embedding = $2::vector, embedding_model = $3
          where id = $1 and (text_embedding is null or embedding_model is distinct from $3)`,
        [row.id, toPgVector(vector.vector), vector.model],
      );
    }
  }

  return candidates
    .map((row) => scoreRow(row, text, image))
    .filter((row): row is SimilarMatch => row !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export async function getAdminSubmission(id: string, cities: CityScope = null) {
  const { rows } = await pool.query(
    `select ${COLUMNS}, st.name as "storeName", st.city, u.email as "ownerEmail"
       from product_submissions s
       join stores st on st.id = s.store_id
       join users u on u.id = st.owner_id
      where s.id = $1 and ${cityFilter(2)}`,
    [id, cities],
  );
  if (!rows[0]) throw notFound('Submission not found');
  const row = rows[0];
  return { ...present(row), storeName: row.storeName as string, city: row.city as string, ownerEmail: row.ownerEmail as string | null };
}

export async function listAdminSubmissions(status: string | null, limit: number, offset: number, cities: CityScope = null) {
  const { rows } = await pool.query(
    `select ${COLUMNS}, st.name as "storeName", st.city, u.email as "ownerEmail"
       from product_submissions s
       join stores st on st.id = s.store_id
       join users u on u.id = st.owner_id
      where ($1::submission_status is null or s.status = $1) and ${cityFilter(4)}
      order by s.created_at desc
      limit $2 offset $3`,
    [status, limit, offset, cities],
  );
  return rows.map((row) => ({ ...present(row), storeName: row.storeName, city: row.city, ownerEmail: row.ownerEmail }));
}

function newSku() {
  return `SB${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function approveSubmission(id: string, mergeIntoProductId: string | null, cities: CityScope = null) {
  return withTransaction(async (c) => {
    const { rows } = await c.query(
      `select s.id, s.status, s.store_id, s.name, s.description, s.category_id, s.brand, s.mrp, s.price, s.stock,
              s.image_key, s.text_embedding, s.embedding_model, s.image_embedding, s.image_embedding_model,
              st.status as store_status, st.city
         from product_submissions s join stores st on st.id = s.store_id
        where s.id = $1 and ${cityFilter(2)} for update of s`,
      [id, cities],
    );
    const sub = rows[0];
    if (!sub) throw notFound('Submission not found');
    if (sub.status !== 'pending') throw conflict(`A ${sub.status} submission cannot be approved`);
    if (sub.store_status !== 'approved') throw conflict('Approve the store before its products');

    let productId = mergeIntoProductId;
    if (productId) {
      const product = await c.query('select id from products where id = $1 and is_active', [productId]);
      if (!product.rows[0]) throw notFound('Product not found');
      const existing = await c.query('select 1 from inventory where store_id = $1 and product_id = $2', [sub.store_id, productId]);
      if (existing.rows[0]) throw conflict('This store already lists that product. Edit it from inventory instead.');
    } else {
      let inserted = null;
      for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
        try {
          inserted = await c.query<{ id: string }>(
            `insert into products
               (sku, name, category_id, brand, description, image_key, mrp, is_active,
                text_embedding, embedding_model, image_embedding, image_embedding_model)
             values ($1, $2, $3, $4, $5, $6, $7, true, $8::vector, $9, $10::vector, $11)
             returning id`,
            [newSku(), sub.name, sub.category_id, sub.brand, sub.description, sub.image_key, sub.mrp,
              sub.text_embedding, sub.embedding_model, sub.image_embedding, sub.image_embedding_model],
          );
        } catch (err) {
          if ((err as { code?: string }).code !== '23505') throw err;
        }
      }
      if (!inserted?.rows[0]) throw conflict('Could not allocate a SKU. Try again.');
      productId = inserted.rows[0].id;
    }

    await c.query(
      `insert into inventory (store_id, product_id, price, stock, is_listed) values ($1, $2, $3, $4, true)`,
      [sub.store_id, productId, sub.price, sub.stock],
    );
    await c.query(`update product_submissions set status = 'approved', product_id = $2, review_note = null where id = $1`, [
      id,
      productId,
    ]);
    return { id, status: 'approved' as const, productId, city: sub.city as string, name: sub.name as string };
  });
}

export async function rejectSubmission(id: string, reason: string, cities: CityScope = null) {
  const { rows } = await pool.query(
    `update product_submissions s set status = 'rejected', review_note = $2
       from stores st
      where s.id = $1 and s.status = 'pending' and st.id = s.store_id and ${cityFilter(3)}
      returning s.id, s.status, st.city, s.name`,
    [id, reason, cities],
  );
  if (!rows[0]) throw notFound('Submission not found');
  return rows[0];
}

export function pipeImage(res: Response, file: { key: string; stream: NodeJS.ReadableStream }, cache: 'public' | 'private') {
  res.setHeader('Content-Type', imageContentType(file.key));
  res.setHeader('Cache-Control', cache === 'public' ? 'public, max-age=86400' : 'private, no-store');
  file.stream.on('error', (err) => {
    logger.error({ err, key: file.key }, 'image stream failed');
    if (!res.headersSent) res.status(404).end();
    else res.destroy(err as Error);
  });
  file.stream.pipe(res);
}
