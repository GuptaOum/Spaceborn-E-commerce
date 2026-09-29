create type service_kind as enum ('3d_printing', 'cnc');
create type listing_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type fab_job_status as enum (
  'submitted', 'quoted', 'pending_payment', 'in_production', 'ready',
  'out_for_delivery', 'delivered', 'declined', 'cancelled', 'expired'
);

create table service_listings (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores(id) on delete cascade,
  kind             service_kind not null,
  title            text not null,
  description      text not null default '',
  materials        text[] not null check (cardinality(materials) between 1 and 20),
  max_x_mm         integer not null check (max_x_mm between 10 and 5000),
  max_y_mm         integer not null check (max_y_mm between 10 and 5000),
  max_z_mm         integer not null check (max_z_mm between 1 and 5000),
  starting_price   numeric(10, 2) not null check (starting_price >= 0),
  turnaround_hours integer not null check (turnaround_hours between 1 and 720),
  status           listing_status not null default 'pending',
  review_note      text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (store_id, kind)
);
create index service_listings_status_idx on service_listings (status, kind);
create trigger service_listings_updated_at before update on service_listings for each row execute function set_updated_at();

create table fab_jobs (
  id               uuid primary key default gen_random_uuid(),
  job_number       bigint generated always as identity (start with 500001) unique,
  customer_id      text not null references users(id),
  listing_id       uuid not null references service_listings(id),
  store_id         uuid not null references stores(id),
  kind             service_kind not null,
  material         text not null,
  quantity         integer not null check (quantity between 1 and 100),
  notes            text not null default '',
  status           fab_job_status not null default 'submitted',
  quote_amount     numeric(10, 2) check (quote_amount > 0),
  quote_note       text,
  ready_in_hours   integer,
  quote_expires_at timestamptz,
  delivery_fee     numeric(10, 2),
  platform_fee     numeric(10, 2),
  grand_total      numeric(10, 2),
  delivery_address jsonb not null,
  distance_km      numeric(6, 2) not null,
  handover_otp     text not null,
  close_reason     text,
  quoted_at        timestamptz,
  paid_at          timestamptz,
  delivered_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index fab_jobs_customer_idx on fab_jobs (customer_id, created_at desc);
create index fab_jobs_store_idx on fab_jobs (store_id, status, created_at desc);
create index fab_jobs_quote_expiry_idx on fab_jobs (quote_expires_at) where status in ('quoted', 'pending_payment');
create trigger fab_jobs_updated_at before update on fab_jobs for each row execute function set_updated_at();

create table fab_files (
  id           uuid primary key default gen_random_uuid(),
  owner_id     text not null references users(id),
  job_id       uuid references fab_jobs(id) on delete cascade,
  storage_key  text not null unique,
  file_name    text not null,
  size_bytes   integer not null check (size_bytes > 0),
  created_at   timestamptz not null default now()
);
create index fab_files_job_idx on fab_files (job_id);
create index fab_files_orphan_idx on fab_files (created_at) where job_id is null;

create table fab_job_history (
  id           bigint generated always as identity primary key,
  job_id       uuid not null references fab_jobs(id) on delete cascade,
  from_status  fab_job_status,
  to_status    fab_job_status not null,
  actor_id     text,
  actor_role   text not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index fab_job_history_job_idx on fab_job_history (job_id, created_at);

alter table payments alter column order_id drop not null;
alter table payments add column fab_job_id uuid unique references fab_jobs(id);
alter table payments add constraint payments_one_target check (num_nonnulls(order_id, fab_job_id) = 1);
