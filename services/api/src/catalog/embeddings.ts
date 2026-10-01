import { createHash } from 'node:crypto';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config.js';
import { logger } from '../logger.js';

/** Deterministic local embedder used in dev and tests, and whenever Bedrock is unset or failing. */
export const LOCAL_EMBED_MODEL = 'local-bow-v1';
const DIM = 256;

export function localEmbed(text: string): number[] {
  const v = new Float64Array(DIM);
  const tokens = text
    .toLowerCase()
    .normalize('NFKC')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  const grams = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) grams.push(`${tokens[i] ?? ''}_${tokens[i + 1] ?? ''}`);
  for (const token of grams) {
    const digest = createHash('sha256').update(token).digest();
    const bucket = digest.readUInt32BE(0) % DIM;
    const sign = (digest[4] ?? 0) & 1 ? 1 : -1;
    v[bucket] = (v[bucket] ?? 0) + sign * (1 + ((digest[5] ?? 0) % 3) / 10);
  }
  let sum = 0;
  for (const n of v) sum += n * n;
  const mag = Math.sqrt(sum) || 1;
  return Array.from(v, (n) => n / mag);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** pgvector literal, e.g. `[0.1,0.2]`. */
export function toPgVector(values: number[]): string {
  return `[${values.map((n) => Number(n.toFixed(6))).join(',')}]`;
}

export function fromPgVector(value: unknown): number[] | null {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== 'string' || value.length < 3) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
  return trimmed.slice(1, -1).split(',').filter(Boolean).map(Number);
}

let bedrock: BedrockRuntimeClient | null = null;
function bedrockClient() {
  bedrock ??= new BedrockRuntimeClient({ region: config.AWS_REGION });
  return bedrock;
}

async function invoke(modelId: string, payload: unknown, timeoutMs?: number): Promise<Record<string, unknown>> {
  const res = await bedrockClient().send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    }),
    timeoutMs ? { abortSignal: AbortSignal.timeout(timeoutMs) } : undefined,
  );
  return JSON.parse(new TextDecoder().decode(res.body)) as Record<string, unknown>;
}

export interface Embedding {
  vector: number[];
  model: string;
}

/** The model new product vectors are written with; vectors from any other model are never compared. */
export const currentTextModel = () => config.BEDROCK_TEXT_MODEL ?? LOCAL_EMBED_MODEL;

export async function embedText(text: string, opts: { timeoutMs?: number } = {}): Promise<Embedding> {
  const input = text.replace(/\s+/g, ' ').trim().slice(0, 8000);
  if (config.BEDROCK_TEXT_MODEL && input) {
    try {
      const json = await invoke(config.BEDROCK_TEXT_MODEL, { inputText: input, dimensions: DIM, normalize: true }, opts.timeoutMs);
      const vector = fromPgVector(json.embedding) ?? (Array.isArray(json.embedding) ? (json.embedding as number[]) : null);
      if (vector?.length) return { vector, model: config.BEDROCK_TEXT_MODEL };
    } catch (err) {
      logger.warn({ err }, 'bedrock text embedding failed, using the local embedder');
    }
  }
  return { vector: localEmbed(input), model: LOCAL_EMBED_MODEL };
}

export async function embedImage(bytes: Buffer): Promise<Embedding | null> {
  if (!config.BEDROCK_IMAGE_MODEL || bytes.length === 0) return null;
  try {
    const json = await invoke(config.BEDROCK_IMAGE_MODEL, {
      inputImage: bytes.toString('base64'),
      embeddingConfig: { outputEmbeddingLength: DIM },
    });
    const vector = Array.isArray(json.embedding) ? (json.embedding as number[]) : null;
    if (!vector?.length) return null;
    return { vector, model: config.BEDROCK_IMAGE_MODEL };
  } catch (err) {
    logger.warn({ err }, 'bedrock image embedding failed');
    return null;
  }
}
