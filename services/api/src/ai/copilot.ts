import { config } from '../config.js';
import type { ShownProduct, Turn } from './memory.js';

export interface CopilotCartLine {
  productId: string;
  name: string;
  category: string | null;
  quantity: number;
  price: number | null;
}

export interface CopilotRequest {
  message: string;
  history: Turn[];
  context: {
    lat: number;
    lng: number;
    areaLabel: string | null;
    signedIn: boolean;
    userName: string | null;
    cart: CopilotCartLine[];
    recentProducts: ShownProduct[];
    authorization: string | null;
  };
}

export type CopilotEvent = { type: string } & Record<string, unknown>;

const MAX_BUFFER = 1_000_000;

export class CopilotUnavailable extends Error {}

/** Streams the FastAPI copilot's server-sent events. Throws CopilotUnavailable when it cannot be reached. */
export async function* streamCopilot(body: CopilotRequest, signal: AbortSignal): AsyncGenerator<CopilotEvent> {
  if (!config.COPILOT_URL || !config.COPILOT_TOKEN) throw new CopilotUnavailable('copilot is not configured');
  // fetch keeps its signal for the whole body, so the header timeout must be cleared once headers arrive
  // or every answer longer than the timeout would be cut off.
  const upstream = new AbortController();
  const headerTimer = setTimeout(() => upstream.abort(new Error('no response headers in time')), config.COPILOT_HEADERS_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(new URL('/v1/chat', config.COPILOT_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Internal-Token': config.COPILOT_TOKEN },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, upstream.signal]),
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new CopilotUnavailable(`copilot request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(headerTimer);
  }
  if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    await res.body?.cancel().catch(() => undefined);
    throw new CopilotUnavailable(`copilot answered ${res.status}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const onAbort = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener('abort', onAbort, { once: true });
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      if (buffer.length > MAX_BUFFER) throw new CopilotUnavailable('copilot event too large');
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data) continue;
        let event: unknown;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        if (event && typeof event === 'object' && typeof (event as CopilotEvent).type === 'string') yield event as CopilotEvent;
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    // Also runs when the caller stops early: closes the upstream connection instead of leaving it open.
    await reader.cancel().catch(() => undefined);
  }
}
