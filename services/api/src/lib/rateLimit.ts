import { cacheIncr } from '../cache.js';

export interface Window {
  name: string;
  seconds: number;
  max: number;
}

export interface LimitResult {
  allowed: boolean;
  /** Seconds until the window that blocked the request resets. */
  retryAfter: number;
}

// Per-process counters for when Redis is not configured or not reachable. Each API task then
// enforces the limit on its own, which is looser than the shared count but never unlimited.
const MAX_LOCAL_KEYS = 20_000;
const local = new Map<string, { count: number; resetAt: number }>();

function localIncr(key: string, seconds: number, now: number): number {
  const hit = local.get(key);
  if (hit && hit.resetAt > now) {
    hit.count += 1;
    return hit.count;
  }
  if (local.size >= MAX_LOCAL_KEYS) {
    for (const [k, v] of local) if (v.resetAt <= now) local.delete(k);
    if (local.size >= MAX_LOCAL_KEYS) local.delete(local.keys().next().value!);
  }
  local.set(key, { count: 1, resetAt: now + seconds * 1000 });
  return 1;
}

/** Fixed-window limits shared by every API task through Redis. All windows count every attempt. */
export async function consume(subject: string, windows: Window[], now = Date.now()): Promise<LimitResult> {
  let blocked: LimitResult | null = null;
  for (const w of windows) {
    const bucket = Math.floor(now / 1000 / w.seconds);
    const key = `rl:${w.name}:${subject}:${bucket}`;
    const count = (await cacheIncr(key, w.seconds)) ?? localIncr(key, w.seconds, now);
    if (count > w.max && !blocked) {
      blocked = { allowed: false, retryAfter: Math.max(1, (bucket + 1) * w.seconds - Math.floor(now / 1000)) };
    }
  }
  return blocked ?? { allowed: true, retryAfter: 0 };
}

export function resetLocalLimits() {
  local.clear();
}
