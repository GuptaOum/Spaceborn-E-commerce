import { createHash, randomUUID } from 'node:crypto';
import { searchNearby } from '../catalog/nearby.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { CircuitBreaker } from '../lib/breaker.js';
import { logger } from '../logger.js';
import { publishInBackground, TOPICS } from '../streams/kafka.js';
import { CopilotUnavailable, streamCopilot, type CopilotCartLine } from './copilot.js';
import { MAX_PRODUCTS, type Conversation, type ShownProduct } from './memory.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Mirrors the pages the copilot's navigate_to tool can open; anything else is dropped here as well.
const NAVIGABLE = /^\/(cart|checkout|orders|fabrication|catalog|compare|wishlist|datasheets|contact|warranty|profile|product\/[0-9a-f-]{36})$/;
const MAX_ANSWER_CHARS = 8000;
const MAX_CARDS = 8;
const FALLBACK_RESULTS = 6;

/** Shared across requests in this process: three failed copilot calls in a row route chats to search for 30s. */
export const copilotBreaker = new CircuitBreaker(3, 30_000);

export type ChatEvent = { type: string } & Record<string, unknown>;

export interface ChatTurnInput {
  conversationId: string;
  message: string;
  conversation: Conversation;
  lat: number;
  lng: number;
  areaLabel: string | null;
  user: { uid: string; name: string | null } | null;
  authorization: string | null;
  cart: CopilotCartLine[];
  send: (event: ChatEvent) => void;
  signal: AbortSignal;
}

export interface ChatTurnResult {
  mode: 'copilot' | 'fallback';
  outcome: 'answered' | 'failed' | 'aborted';
  answer: string;
  shown: ShownProduct[];
  meta: Record<string, unknown>;
}

function cardList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && typeof p.id === 'string' && UUID.test(p.id) && typeof p.name === 'string')
    .slice(0, MAX_CARDS);
}

/** Only well-formed actions reach the browser, whatever the model was talked into producing. */
function safeAction(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  if (a.kind === 'navigate' && typeof a.path === 'string' && NAVIGABLE.test(a.path)) return { kind: 'navigate', path: a.path };
  if (
    a.kind === 'add_to_cart' &&
    typeof a.productId === 'string' &&
    UUID.test(a.productId) &&
    Number.isInteger(a.quantity) &&
    (a.quantity as number) >= 1 &&
    (a.quantity as number) <= 50 &&
    cardList([a.product])[0]?.id === a.productId
  ) {
    return { kind: 'add_to_cart', productId: a.productId, quantity: a.quantity, product: a.product };
  }
  return null;
}

function remember(shown: ShownProduct[], products: Record<string, unknown>[]) {
  for (const p of products) {
    if (!shown.some((s) => s.id === p.id)) shown.push({ id: p.id as string, name: String(p.name).slice(0, 200) });
  }
}

async function runCopilot(input: ChatTurnInput, shown: ShownProduct[]): Promise<ChatTurnResult | null> {
  let answer = '';
  let meta: Record<string, unknown> = {};
  let finished = false;
  try {
    const events = streamCopilot(
      {
        message: input.message,
        history: input.conversation.turns,
        context: {
          lat: input.lat,
          lng: input.lng,
          areaLabel: input.areaLabel,
          signedIn: Boolean(input.user),
          userName: input.user?.name ?? null,
          cart: input.cart,
          recentProducts: input.conversation.products,
          authorization: input.user ? input.authorization : null,
        },
      },
      input.signal,
    );
    for await (const event of events) {
      switch (event.type) {
        case 'token': {
          if (typeof event.text !== 'string' || answer.length >= MAX_ANSWER_CHARS) break;
          const text = event.text.slice(0, MAX_ANSWER_CHARS - answer.length);
          answer += text;
          input.send({ type: 'token', text });
          break;
        }
        case 'products': {
          const products = cardList(event.products);
          if (products.length === 0) break;
          remember(shown, products);
          input.send({ type: 'products', products });
          break;
        }
        case 'action': {
          const action = safeAction(event.action);
          if (!action) break;
          if (action.kind === 'add_to_cart') remember(shown, [action.product as Record<string, unknown>]);
          input.send({ type: 'action', action });
          break;
        }
        case 'done':
          meta = (event.meta as Record<string, unknown>) ?? {};
          finished = true;
          break;
        case 'error':
          throw new CopilotUnavailable(`copilot error: ${String(event.code)}`);
      }
      if (finished) break;
    }
    if (!finished) throw new CopilotUnavailable('copilot stream ended early');
    copilotBreaker.success();
    // The model ran out of tool rounds without writing anything: let search answer instead of silence.
    if (!answer) return null;
    return { mode: 'copilot', outcome: 'answered', answer, shown, meta };
  } catch (err) {
    if (input.signal.aborted) {
      copilotBreaker.release();
      return { mode: 'copilot', outcome: 'aborted', answer, shown, meta };
    }
    copilotBreaker.failure();
    logger.warn({ err, breaker: copilotBreaker.state }, 'copilot failed');
    if (!answer) return null;
    // Part of an answer already reached the customer; a search dump appended to it would be confusing.
    input.send({ type: 'error', message: 'The answer was cut off. Please ask again.' });
    return { mode: 'copilot', outcome: 'failed', answer, shown, meta };
  }
}

/** Without the language model the customer still gets nearby, in-stock matches for what they typed. */
async function runFallback(input: ChatTurnInput, shown: ShownProduct[]): Promise<ChatTurnResult> {
  const query = input.message.replace(/\s+/g, ' ').trim().slice(0, 80);
  let products: Record<string, unknown>[] = [];
  try {
    products = cardList((await searchNearby(pool, { lat: input.lat, lng: input.lng, query, limit: FALLBACK_RESULTS })).products);
  } catch (err) {
    logger.warn({ err }, 'copilot fallback search failed');
  }
  const answer = products.length
    ? 'Our assistant is taking a short break, so here are the closest matches in stock near you:'
    : "Our assistant is taking a short break and nothing nearby matched those words. Try a product name, like 'ESP32' or 'servo motor'.";
  if (products.length) {
    remember(shown, products);
    input.send({ type: 'products', products });
  }
  input.send({ type: 'token', text: answer });
  return {
    mode: 'fallback',
    outcome: 'answered',
    answer,
    shown,
    meta: { toolCalls: ['search_catalog'], zeroResultQueries: products.length ? [] : [query] },
  };
}

export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const started = Date.now();
  const shown: ShownProduct[] = [];
  const useCopilot = Boolean(config.COPILOT_URL) && copilotBreaker.tryAcquire();
  const result =
    (useCopilot ? await runCopilot(input, shown) : null) ??
    (input.signal.aborted
      ? { mode: 'copilot' as const, outcome: 'aborted' as const, answer: '', shown, meta: {} }
      : await runFallback(input, shown));

  publishInBackground(TOPICS.ai, {
    key: `${input.lat.toFixed(2)}:${input.lng.toFixed(2)}`,
    value: {
      eventId: randomUUID(),
      type: 'ai.chat.completed',
      at: new Date().toISOString(),
      // Hashed and coarse: the stream is for demand analytics, not for following a customer around.
      conversation: createHash('sha256').update(input.conversationId).digest('hex').slice(0, 16),
      signedIn: Boolean(input.user),
      mode: result.mode,
      outcome: result.outcome,
      area: { lat: Number(input.lat.toFixed(2)), lng: Number(input.lng.toFixed(2)), label: input.areaLabel },
      toolCalls: Array.isArray(result.meta.toolCalls) ? result.meta.toolCalls : [],
      zeroResultQueries: Array.isArray(result.meta.zeroResultQueries) ? result.meta.zeroResultQueries : [],
      productsShown: result.shown.length,
      findings: Array.isArray(result.meta.findings) ? result.meta.findings : [],
      usage: result.meta.usage ?? null,
      model: result.meta.model ?? null,
      latencyMs: Date.now() - started,
    },
  });
  return result;
}

/** Newest products first, then the ones from earlier turns, without duplicates. */
export function mergeShown(previous: ShownProduct[], latest: ShownProduct[]): ShownProduct[] {
  const merged: ShownProduct[] = [];
  for (const p of [...latest, ...previous]) if (!merged.some((m) => m.id === p.id)) merged.push(p);
  return merged.slice(0, MAX_PRODUCTS);
}
