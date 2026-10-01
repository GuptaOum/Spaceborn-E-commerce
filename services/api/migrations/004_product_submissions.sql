-- Vendors propose new catalog products. Nothing is sellable until an admin approves it,
-- and approval only stocks the submitting store, so other cities never see it.

create type submission_status as enum ('pending', 'approved', 'rejected');

create extension if not exists vector;

alter table products add column if not exists image_key text;
alter table products add column if not exists text_embedding vector(256);
alter table products add column if not exists embedding_model text;
alter table products add column if not exists image_embedding vector(256);
alter table products add column if not exists image_embedding_model text;

create table product_submissions (
  id                     uuid primary key default gen_random_uuid(),
  store_id               uuid not null references stores(id) on delete cascade,
  name                   text not null check (length(name) between 3 and 200),
  description            text not null default '',
  category_id            text not null references categories(id),
  brand                  text,
  mrp                    numeric(10, 2) not null check (mrp > 0),
  price                  numeric(10, 2) not null check (price > 0 and price <= mrp),
  stock                  integer not null check (stock >= 0 and stock <= 100000),
  image_key              text not null,
  status                 submission_status not null default 'pending',
  review_note            text,
  product_id             uuid references products(id),
  text_embedding         vector(256),
  embedding_model        text,
  image_embedding        vector(256),
  image_embedding_model  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index product_submissions_store_idx on product_submissions (store_id, created_at desc);
create index product_submissions_status_idx on product_submissions (status, created_at desc);
create trigger product_submissions_updated_at before update on product_submissions
  for each row execute function set_updated_at();

-- Cosine nearest-neighbour. Null embeddings are left out of the index.
create index products_text_hnsw on products using hnsw (text_embedding vector_cosine_ops);
create index products_image_hnsw on products using hnsw (image_embedding vector_cosine_ops);
create index product_submissions_text_hnsw on product_submissions using hnsw (text_embedding vector_cosine_ops);
create index product_submissions_image_hnsw on product_submissions using hnsw (image_embedding vector_cosine_ops);
