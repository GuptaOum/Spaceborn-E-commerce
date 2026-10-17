import type pg from 'pg';

export interface StreamRecord {
  topic: string;
  partition: number;
  offset: string;
  value: Record<string, unknown>;
}

const day = (iso: unknown) => {
  const d = new Date(typeof iso === 'string' ? iso : Date.now());
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10);
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

/** Normalised so "ESP32 Cam " and "esp32 cam" count as one unmet need. */
export const normaliseQuery = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}.+#-]+/gu, ' ').trim().slice(0, 80);

async function applyAiEvent(c: pg.PoolClient, v: Record<string, unknown>) {
  if (v.type !== 'ai.chat.completed') return;
  const mode = v.mode === 'fallback' ? 'fallback' : 'copilot';
  const usage = (v.usage ?? {}) as Record<string, unknown>;
  await c.query(
    `insert into ai_usage_daily (day, mode, chats, answered, input_tokens, output_tokens, latency_ms_total)
     values ($1, $2, 1, $3, $4, $5, $6)
     on conflict (day, mode) do update set
       chats = ai_usage_daily.chats + 1,
       answered = ai_usage_daily.answered + excluded.answered,
       input_tokens = ai_usage_daily.input_tokens + excluded.input_tokens,
       output_tokens = ai_usage_daily.output_tokens + excluded.output_tokens,
       latency_ms_total = ai_usage_daily.latency_ms_total + excluded.latency_ms_total`,
    [day(v.at), mode, v.outcome === 'answered' ? 1 : 0, num(usage.input), num(usage.output), num(v.latencyMs)],
  );
  const area = (v.area ?? {}) as Record<string, unknown>;
  const lat = Number(area.lat);
  const lng = Number(area.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  const queries = Array.isArray(v.zeroResultQueries) ? v.zeroResultQueries : [];
  const label = typeof area.label === 'string' ? area.label.slice(0, 120) : null;
  for (const raw of new Set(queries.filter((q): q is string => typeof q === 'string').map(normaliseQuery))) {
    if (raw.length < 2) continue;
    await c.query(
      `insert into ai_demand_signals (query, area_lat, area_lng, area_label, misses)
       values ($1, round($2::numeric, 2), round($3::numeric, 2), $4, 1)
       on conflict (query, area_lat, area_lng) do update set
         misses = ai_demand_signals.misses + 1,
         last_seen = now(),
         area_label = coalesce(excluded.area_label, ai_demand_signals.area_label)`,
      [raw, lat, lng, label],
    );
  }
}

async function applyDomainEvent(c: pg.PoolClient, v: Record<string, unknown>) {
  const data = (v.data ?? {}) as Record<string, unknown>;
  const status = v.type === 'order.placed' ? 'placed' : v.type === 'order.status_changed' && typeof data.to === 'string' ? data.to : null;
  if (!status) return;
  await c.query(
    `insert into order_funnel_daily (day, status, events) values ($1, $2, 1)
     on conflict (day, status) do update set events = order_funnel_daily.events + 1`,
    [day(v.occurredAt), status.slice(0, 40)],
  );
}

/**
 * Applies one message unless this consumer group already has. The inbox row and the aggregates
 * commit together, so a redelivery after a crash is skipped instead of counted twice.
 */
export async function applyRecord(c: pg.PoolClient, group: string, record: StreamRecord, topics: { ai: string; domain: string }) {
  const eventId = record.value.eventId;
  const id =
    typeof eventId === 'string' || typeof eventId === 'number'
      ? `${record.topic}:${String(eventId).slice(0, 100)}`
      : `${record.topic}:${record.partition}:${record.offset}`;
  const { rowCount } = await c.query(
    'insert into stream_inbox (consumer_group, event_id) values ($1, $2) on conflict do nothing',
    [group, id],
  );
  if (rowCount === 0) return false;
  if (record.topic === topics.ai) await applyAiEvent(c, record.value);
  else if (record.topic === topics.domain) await applyDomainEvent(c, record.value);
  return true;
}

/** Kafka keeps a week of history, so inbox rows older than that can no longer be redelivered. */
export async function pruneInbox(db: pg.Pool, group: string, days = 14) {
  const { rowCount } = await db.query(
    `delete from stream_inbox where consumer_group = $1 and processed_at < now() - make_interval(days => $2)`,
    [group, days],
  );
  return rowCount ?? 0;
}
