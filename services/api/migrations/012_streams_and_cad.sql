-- Outbox relay to Kafka. Rows written before this migration are relayed too once Kafka is enabled,
-- so a new consumer can be backfilled from the full history.
alter table outbox add column streamed_at timestamptz;
create index outbox_unstreamed_idx on outbox (id) where streamed_at is null;

-- Written by the Python CAD worker (Celery) for each uploaded design file.
create table fab_file_analysis (
  file_id      uuid primary key references fab_files(id) on delete cascade,
  status       text not null check (status in ('done', 'failed', 'unsupported')),
  metrics      jsonb,
  estimate     jsonb,
  error        text,
  worker       text,
  analyzed_at  timestamptz not null default now()
);

-- Idempotent-consumer inbox: the event id is recorded in the same transaction as the rows the event
-- produced, so a redelivery is skipped. Keyed by event id rather than Kafka offset because offsets
-- restart from zero if the broker loses its log.
create table stream_inbox (
  consumer_group text not null,
  event_id       text not null,
  processed_at   timestamptz not null default now(),
  primary key (consumer_group, event_id)
);
create index stream_inbox_processed_idx on stream_inbox (processed_at);

-- What customers asked the copilot for that no nearby store stocks: a restocking signal for vendors.
create table ai_demand_signals (
  query       text not null,
  area_lat    numeric(5, 2) not null,
  area_lng    numeric(6, 2) not null,
  area_label  text,
  misses      integer not null default 0,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (query, area_lat, area_lng)
);
create index ai_demand_recent_idx on ai_demand_signals (last_seen desc);

create table ai_usage_daily (
  day               date not null,
  mode              text not null,
  chats             integer not null default 0,
  answered          integer not null default 0,
  input_tokens      bigint not null default 0,
  output_tokens     bigint not null default 0,
  latency_ms_total  bigint not null default 0,
  primary key (day, mode)
);

create table order_funnel_daily (
  day     date not null,
  status  text not null,
  events  integer not null default 0,
  primary key (day, status)
);
