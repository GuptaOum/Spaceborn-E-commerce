import { pool, type Db } from '../db/pool.js';
import { logger } from '../logger.js';
import { currentTextModel, embedText, toPgVector, type Embedding } from './embeddings.js';

/** Customers are waiting: past this, search answers with keyword matches only. */
const QUERY_EMBED_TIMEOUT_MS = 1200;
const CACHE_MAX = 500;
const CACHE_TTL_MS = 30 * 60_000;

const queryCache = new Map<string, { embedding: Embedding; at: number }>();

/**
 * Embeds a customer search query, or returns null when the configured model is unavailable.
 * A fallback vector from a different model would never match stored product vectors, so it is dropped.
 */
export async function embedQuery(query: string): Promise<Embedding | null> {
  const key = query.trim().toLowerCase();
  if (key.length < 2) return null;
  const hit = queryCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.embedding;

  const embedding = await embedText(key, { timeoutMs: QUERY_EMBED_TIMEOUT_MS });
  if (embedding.model !== currentTextModel()) return null;

  if (queryCache.size >= CACHE_MAX) queryCache.delete(queryCache.keys().next().value!);
  queryCache.set(key, { embedding, at: Date.now() });
  return embedding;
}

/**
 * Gives every active product a text vector from the current model. Uses the same `name\ndescription`
 * text as vendor submissions, so duplicate detection and customer search share one vector per product.
 * Stops early if the model is unavailable and picks up where it left off on the next call.
 */
export async function backfillProductEmbeddings(db: Db = pool, limit = 25): Promise<number> {
  const model = currentTextModel();
  const { rows } = await db.query<{ id: string; name: string; description: string | null }>(
    `select id, name, description from products
      where is_active and (text_embedding is null or embedding_model is distinct from $1)
      order by id limit $2`,
    [model, limit],
  );
  let done = 0;
  for (const row of rows) {
    const embedding = await embedText(`${row.name}\n${row.description ?? ''}`);
    if (embedding.model !== model) {
      logger.warn({ model }, 'embedding model unavailable, product backfill paused');
      break;
    }
    await db.query(`update products set text_embedding = $2::vector, embedding_model = $3 where id = $1`, [
      row.id,
      toPgVector(embedding.vector),
      embedding.model,
    ]);
    done += 1;
  }
  return done;
}
