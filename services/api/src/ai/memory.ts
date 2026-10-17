import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { cacheConnected, cacheGet, cacheSet } from '../cache.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ShownProduct {
  id: string;
  name: string;
}

export interface Conversation {
  turns: Turn[];
  /** Products the copilot showed most recently, so "add the second one" can be resolved next turn. */
  products: ShownProduct[];
}

const TTL_SECONDS = 2 * 60 * 60;
export const MAX_TURNS = 12;
export const MAX_PRODUCTS = 12;
const MAX_TURN_CHARS = 4000;
const MAX_LOCAL = 2000;
const DYNAMO_TIMEOUT_MS = 1500;

// A signed-in customer's conversations are namespaced by uid, so a leaked id is useless to anyone else.
const key = (owner: string | null, conversationId: string) => `conv#${owner ?? 'anon'}#${conversationId}`;

let dynamo: DynamoDBDocumentClient | null = null;
const dynamoClient = () =>
  (dynamo ??= DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.AWS_REGION, maxAttempts: 2 })));

// Used only when neither DynamoDB nor Redis is available; a restart forgets these conversations.
const local = new Map<string, { conversation: Conversation; expiresAt: number }>();

const empty = (): Conversation => ({ turns: [], products: [] });

function sanitize(raw: unknown): Conversation {
  const value = (raw ?? {}) as Partial<Conversation>;
  const turns = Array.isArray(value.turns)
    ? value.turns.filter(
        (t): t is Turn => !!t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string',
      )
    : [];
  const products = Array.isArray(value.products)
    ? value.products.filter((p): p is ShownProduct => !!p && typeof p.id === 'string' && typeof p.name === 'string')
    : [];
  return { turns, products };
}

function trim(c: Conversation): Conversation {
  return {
    turns: c.turns.slice(-MAX_TURNS).map((t) => ({ role: t.role, text: t.text.slice(0, MAX_TURN_CHARS) })),
    products: c.products.slice(0, MAX_PRODUCTS).map((p) => ({ id: p.id, name: p.name.slice(0, 200) })),
  };
}

/**
 * DynamoDB (one item per conversation, expired by TTL) when AI_MEMORY_TABLE is set, otherwise Redis,
 * otherwise process memory. A failed read starts a fresh conversation rather than failing the chat.
 */
export async function loadConversation(owner: string | null, conversationId: string): Promise<Conversation> {
  const k = key(owner, conversationId);
  if (config.AI_MEMORY_TABLE) {
    try {
      const res = await dynamoClient().send(new GetCommand({ TableName: config.AI_MEMORY_TABLE, Key: { pk: k } }), {
        abortSignal: AbortSignal.timeout(DYNAMO_TIMEOUT_MS),
      });
      // TTL deletion runs lazily, so an expired item can still be returned for a while.
      if (!res.Item || Number(res.Item.expiresAt) * 1000 < Date.now()) return empty();
      return sanitize(res.Item);
    } catch (err) {
      logger.warn({ err }, 'conversation read from dynamodb failed');
      return empty();
    }
  }
  if (cacheConnected()) return sanitize(await cacheGet(`ai:${k}`));
  const hit = local.get(k);
  if (!hit || hit.expiresAt < Date.now()) {
    local.delete(k);
    return empty();
  }
  return hit.conversation;
}

export async function saveConversation(owner: string | null, conversationId: string, conversation: Conversation) {
  const k = key(owner, conversationId);
  const value = trim(conversation);
  if (config.AI_MEMORY_TABLE) {
    try {
      await dynamoClient().send(
        new PutCommand({
          TableName: config.AI_MEMORY_TABLE,
          Item: {
            pk: k,
            owner: owner ?? 'anon',
            ...value,
            updatedAt: new Date().toISOString(),
            expiresAt: Math.floor(Date.now() / 1000) + TTL_SECONDS,
          },
        }),
        { abortSignal: AbortSignal.timeout(DYNAMO_TIMEOUT_MS) },
      );
    } catch (err) {
      logger.warn({ err }, 'conversation write to dynamodb failed');
    }
    return;
  }
  if (cacheConnected()) {
    await cacheSet(`ai:${k}`, value, TTL_SECONDS);
    return;
  }
  local.delete(k);
  if (local.size >= MAX_LOCAL) local.delete(local.keys().next().value!);
  local.set(k, { conversation: value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}
