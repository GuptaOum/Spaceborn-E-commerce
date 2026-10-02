create table product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  rating integer not null check(rating between 1 and 5),
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index product_reviews_user_product_idx on product_reviews(product_id, user_id);
create trigger product_reviews_updated_at before update on product_reviews for each row execute function set_updated_at();
