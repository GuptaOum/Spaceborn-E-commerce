create extension if not exists pg_trgm;

create type user_role as enum ('customer', 'vendor', 'admin');
create type store_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type order_status as enum (
  'pending_payment', 'placed', 'accepted', 'packing', 'ready_for_pickup',
  'out_for_delivery', 'delivered', 'cancelled', 'expired'
);
create type payment_status as enum ('created', 'captured', 'failed', 'refund_pending', 'refunded');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Firebase is the identity provider; id is the Firebase uid.
create table users (
  id          text primary key,
  email       text,
  full_name   text,
  phone       text,
  role        user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger users_updated_at before update on users for each row execute function set_updated_at();

create table stores (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            text not null references users(id),
  name                text not null check (length(name) between 2 and 120),
  phone               text not null,
  gstin               text,
  address_line        text not null,
  city                text not null,
  pincode             text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  latitude            double precision not null check (latitude between -90 and 90),
  longitude           double precision not null check (longitude between -180 and 180),
  delivery_radius_km  numeric(5, 2) not null default 5 check (delivery_radius_km > 0 and delivery_radius_km <= 25),
  avg_prep_minutes    integer not null default 8 check (avg_prep_minutes between 1 and 120),
  status              store_status not null default 'pending',
  is_online           boolean not null default false,
  review_note         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index stores_owner_unique on stores (owner_id);
create index stores_live_idx on stores (status, is_online);
create trigger stores_updated_at before update on stores for each row execute function set_updated_at();

create table categories (
  id          text primary key,
  name        text not null,
  sort_order  integer not null default 0
);

-- Master catalog, curated by admins. Stores list these products with their own price and stock.
create table products (
  id           uuid primary key default gen_random_uuid(),
  sku          text not null unique,
  name         text not null,
  category_id  text not null references categories(id),
  brand        text,
  description  text not null default '',
  image_url    text,
  mrp          numeric(10, 2) not null check (mrp > 0),
  gst_rate     numeric(4, 2) not null default 18 check (gst_rate between 0 and 28),
  hsn          text,
  specs        jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index products_category_idx on products (category_id) where is_active;
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);
create trigger products_updated_at before update on products for each row execute function set_updated_at();

create table inventory (
  store_id    uuid not null references stores(id) on delete cascade,
  product_id  uuid not null references products(id),
  price       numeric(10, 2) not null check (price > 0),
  stock       integer not null check (stock >= 0),
  is_listed   boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (store_id, product_id)
);
create index inventory_product_idx on inventory (product_id);
create trigger inventory_updated_at before update on inventory for each row execute function set_updated_at();

create table orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      bigint generated always as identity (start with 100001) unique,
  customer_id       text not null references users(id),
  store_id          uuid not null references stores(id),
  status            order_status not null default 'pending_payment',
  items_total       numeric(10, 2) not null,
  delivery_fee      numeric(10, 2) not null,
  platform_fee      numeric(10, 2) not null,
  grand_total       numeric(10, 2) not null,
  delivery_address  jsonb not null,
  delivery_lat      double precision not null,
  delivery_lng      double precision not null,
  distance_km       numeric(6, 2) not null,
  eta_minutes       integer not null,
  handover_otp      text not null,
  reserved_until    timestamptz,
  idempotency_key   text not null,
  cancel_reason     text,
  placed_at         timestamptz,
  accepted_at       timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (customer_id, idempotency_key)
);
create index orders_customer_idx on orders (customer_id, created_at desc);
create index orders_store_status_idx on orders (store_id, status, created_at desc);
create index orders_reservation_idx on orders (reserved_until) where status = 'pending_payment';
create trigger orders_updated_at before update on orders for each row execute function set_updated_at();

create table order_items (
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  uuid not null references products(id),
  name        text not null,
  sku         text not null,
  image_url   text,
  unit_price  numeric(10, 2) not null,
  quantity    integer not null check (quantity > 0),
  line_total  numeric(10, 2) not null,
  primary key (order_id, product_id)
);

create table order_status_history (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references orders(id) on delete cascade,
  from_status  order_status,
  to_status    order_status not null,
  actor_id     text,
  actor_role   text not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index order_status_history_order_idx on order_status_history (order_id, created_at);

create table payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null unique references orders(id),
  provider             text not null,
  provider_order_id    text not null unique,
  provider_payment_id  text unique,
  amount_paise         bigint not null check (amount_paise > 0),
  status               payment_status not null default 'created',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger payments_updated_at before update on payments for each row execute function set_updated_at();

-- Transactional outbox: written in the same transaction as the state change, drained by the worker.
create table outbox (
  id               bigint generated always as identity primary key,
  topic            text not null,
  payload          jsonb not null,
  attempts         integer not null default 0,
  next_attempt_at  timestamptz not null default now(),
  last_error       text,
  processed_at     timestamptz,
  failed_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index outbox_pending_idx on outbox (next_attempt_at) where processed_at is null and failed_at is null;
