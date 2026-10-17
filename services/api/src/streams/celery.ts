import { randomUUID } from 'node:crypto';
import { listPush } from '../cache.js';

/**
 * A Celery task message (protocol 2, JSON body) as the Redis transport stores it, so the Python
 * workers consume it exactly like a task sent with `apply_async`. Results are not stored.
 */
export function celeryMessage(task: string, args: unknown[], queue: string, id: string = randomUUID()): string {
  const body = Buffer.from(JSON.stringify([args, {}, { callbacks: null, errbacks: null, chain: null, chord: null }])).toString('base64');
  return JSON.stringify({
    body,
    'content-encoding': 'utf-8',
    'content-type': 'application/json',
    headers: {
      lang: 'py',
      task,
      id,
      shadow: null,
      eta: null,
      expires: null,
      group: null,
      group_index: null,
      retries: 0,
      timelimit: [null, null],
      root_id: id,
      parent_id: null,
      argsrepr: JSON.stringify(args).slice(0, 200),
      kwargsrepr: '{}',
      origin: 'spaceborn-api',
      ignore_result: true,
    },
    properties: {
      correlation_id: id,
      reply_to: '',
      delivery_mode: 2,
      delivery_info: { exchange: '', routing_key: queue },
      priority: 0,
      body_encoding: 'base64',
      delivery_tag: randomUUID(),
    },
  });
}

/** Kombu's Redis transport pops from the right of a list named after the queue. */
export async function sendCeleryTask(task: string, args: unknown[], queue: string): Promise<string> {
  const id = randomUUID();
  await listPush(queue, celeryMessage(task, args, queue, id));
  return id;
}
