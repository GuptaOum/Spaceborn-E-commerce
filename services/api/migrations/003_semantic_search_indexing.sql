-- 003_semantic_search_indexing.sql
-- High performance full-text and semantic keyword search index with trigram acceleration

alter table products add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(category_id, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(specs::text, '')), 'D')
  ) stored;

create index if not exists products_search_tsv_idx on products using gin (search_tsv);
create index if not exists products_sku_trgm_idx on products using gin (sku gin_trgm_ops);
create index if not exists products_brand_trgm_idx on products using gin (brand gin_trgm_ops);
create index if not exists products_desc_trgm_idx on products using gin (description gin_trgm_ops);
