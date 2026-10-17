import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../auth.js';
import { mergeShown, runChatTurn } from '../ai/chat.js';
import type { CopilotCartLine } from '../ai/copilot.js';
import { loadConversation, saveConversation } from '../ai/memory.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { HttpError, parse } from '../errors.js';
import { consume } from '../lib/rateLimit.js';
import { logger } from '../logger.js';
import { MAX_ITEMS_PER_LINE } from '../orders/pricing.js';
import { latitude, longitude, uuid } from './schemas.js';

export const aiRouter = Router();

const KEEPALIVE_MS = 15_000;
const TURN_TIMEOUT_MS = 50_000;

const chatBody = z.object({
  message: z.string().trim().min(1).max(1000),
  conversationId: uuid.optional(),
  lat: latitude,
  lng: longitude,
  areaLabel: z.string().trim().max(120).optional(),
  cart: z
    .array(z.object({ productId: uuid, quantity: z.number().int().min(1).max(MAX_ITEMS_PER_LINE) }))
    .max(40)
    .default([]),
});

// Names come from the catalog, not the browser, so a crafted cart cannot smuggle text into the prompt.
async function resolveCart(items: { productId: string; quantity: number }[]): Promise<CopilotCartLine[]> {
  if (items.length === 0) return [];
  const { rows } = await pool.query<{ id: string; name: string; category: string | null }>(
    `select p.id, p.name, c.name as category from products p left join categories c on c.id = p.category_id
      where p.id = any($1::uuid[]) and p.is_active`,
    [items.map((i) => i.productId)],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return items.flatMap((i) => {
    const p = byId.get(i.productId);
    return p ? [{ productId: p.id, name: p.name, category: p.category, quantity: i.quantity, price: null }] : [];
  });
}

aiRouter.post('/ai/chat', optionalAuth, async (req, res) => {
  const body = parse(chatBody, req.body);
  const limit = await consume(req.user ? `u:${req.user.uid}` : `ip:${req.ip ?? 'unknown'}`, [
    { name: 'ai10m', seconds: 600, max: config.AI_CHAT_PER_10_MIN },
    { name: 'aiday', seconds: 86_400, max: config.AI_CHAT_PER_DAY },
  ]);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    throw new HttpError(429, 'rate_limited', 'You are sending messages very quickly. Please wait a few minutes and try again.');
  }

  const owner = req.user?.uid ?? null;
  const conversationId = body.conversationId ?? randomUUID();
  const [conversation, cart] = await Promise.all([loadConversation(owner, conversationId), resolveCart(body.cart)]);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const abort = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    abort.abort();
  }, TURN_TIMEOUT_MS);
  res.on('close', () => {
    if (!res.writableFinished) abort.abort();
  });
  const send = (event: Record<string, unknown>) => {
    if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  // Comment frames keep load balancers from closing the stream while the model is thinking.
  const keepalive = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(': ping\n\n');
  }, KEEPALIVE_MS);

  send({ type: 'meta', conversationId });
  try {
    const result = await runChatTurn({
      conversationId,
      message: body.message,
      conversation,
      lat: body.lat,
      lng: body.lng,
      areaLabel: body.areaLabel ?? null,
      user: req.user ? { uid: req.user.uid, name: req.user.name } : null,
      authorization: req.headers.authorization ?? null,
      cart,
      send,
      signal: abort.signal,
    });
    if (result.outcome === 'aborted' && timedOut) send({ type: 'error', message: 'That took too long. Please try again.' });
    send({ type: 'done', mode: result.mode });
    // Saved before the stream closes so a quick follow-up question already sees this turn.
    if (result.outcome === 'answered') {
      await saveConversation(owner, conversationId, {
        turns: [...conversation.turns, { role: 'user', text: body.message }, { role: 'assistant', text: result.answer }],
        products: mergeShown(conversation.products, result.shown),
      });
    }
  } catch (err) {
    logger.error({ err }, 'chat turn failed');
    send({ type: 'error', message: 'Something went wrong. Please try again.' });
  } finally {
    clearTimeout(timeout);
    clearInterval(keepalive);
    res.end();
  }
});
