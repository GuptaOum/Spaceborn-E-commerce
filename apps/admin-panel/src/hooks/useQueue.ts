'use client';

import { api } from '@spaceborn/web-core/api';
import { useLoad } from '@spaceborn/web-core/use-load';

export type QueueCounts = Record<'stores' | 'services' | 'submissions', Record<string, number>>;

/** Counts per status for the review queues; refresh after any decision so chips and badges stay right. */
export function useQueue(enabled: boolean) {
  return useLoad(() => (enabled ? api<{ queue: QueueCounts }>('/admin/queue').then((r) => r.queue) : Promise.resolve(null)), [enabled]);
}
