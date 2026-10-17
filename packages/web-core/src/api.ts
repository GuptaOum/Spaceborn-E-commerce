import { firebaseAuth } from './firebase';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

// Same-origin: the load balancer (prod) or Next rewrites (dev) route /v1 to the API.
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await firebaseAuth().currentUser?.getIdToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach Spaceborn. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const error = payload?.error;
    throw new ApiError(res.status, error?.code ?? 'unknown', error?.message ?? `Request failed (${res.status})`, error?.details);
  }
  return payload as T;
}

export const newIdempotencyKey = () => crypto.randomUUID().replace(/-/g, '');

async function authHeader(): Promise<Record<string, string>> {
  const token = await firebaseAuth().currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const res = await fetch(`/v1${path}`, {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    body: file,
  }).catch(() => {
    throw new ApiError(0, 'network', 'Upload failed. Check your connection and try again.');
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message = res.status === 413 ? 'File is too large.' : (payload?.error?.message ?? `Upload failed (${res.status})`);
    throw new ApiError(res.status, payload?.error?.code ?? 'upload_failed', message);
  }
  return payload as T;
}

export interface ServerEvent<T> {
  /** The SSE `event:` name, or 'message' when the server did not set one. */
  event: string;
  data: T;
}

/** POSTs JSON and yields each server-sent event's parsed `data:` payload as it arrives. */
export async function* streamEvents<T>(path: string, body: unknown, signal: AbortSignal): AsyncGenerator<T> {
  for await (const frame of streamServerEvents<T>(path, { method: 'POST', body }, signal)) yield frame.data;
}

/**
 * Opens a server-sent event stream with the bearer token (EventSource cannot send headers) and
 * yields each named frame. GET for long-lived feeds such as delivery tracking, POST for chat.
 */
export async function* streamServerEvents<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown },
  signal: AbortSignal,
): AsyncGenerator<ServerEvent<T>> {
  let res: Response;
  try {
    const headers: Record<string, string> = { ...(await authHeader()), Accept: 'text/event-stream' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    res = await fetch(`/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
  } catch {
    if (signal.aborted) return;
    throw new ApiError(0, 'network', 'Could not reach Spaceborn. Check your connection and try again.');
  }
  if (!res.ok || !res.body) {
    const payload = await res.json().catch(() => null);
    const error = payload?.error;
    throw new ApiError(res.status, error?.code ?? 'unknown', error?.message ?? `Request failed (${res.status})`, {
      retryAfter: Number(res.headers.get('Retry-After')) || undefined,
    });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = frame.split('\n');
        const data = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data) continue;
        const named = lines.find((line) => line.startsWith('event:'));
        const event = named ? named.slice(6).trim() || 'message' : 'message';
        try {
          yield { event, data: JSON.parse(data) as T };
        } catch {
          // A malformed frame is skipped rather than ending the whole answer.
        }
      }
    }
  } catch {
    if (signal.aborted) return;
    throw new ApiError(0, 'network', 'The connection dropped. Please try again.');
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

// <img> cannot send the bearer token, so private photos are fetched and shown from a blob URL.
export async function fetchAuthedBlob(path: string): Promise<string> {
  const res = await fetch(`/v1${path}`, { headers: await authHeader() }).catch(() => {
    throw new ApiError(0, 'network', 'Could not load the image.');
  });
  if (!res.ok) throw new ApiError(res.status, 'download_failed', 'Could not load the image.');
  return URL.createObjectURL(await res.blob());
}

// File downloads need the auth header, so they cannot be plain links.
export async function downloadFile(path: string, fileName: string) {
  const res = await fetch(`/v1${path}`, { headers: await authHeader() });
  if (!res.ok) throw new ApiError(res.status, 'download_failed', 'Could not download the file.');
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
