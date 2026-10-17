-- An admin can take one shop's listing off the website, for example when it still sells above a
-- lowered MRP. The shop cannot relist it while the hold stands; for a price hold, repricing to the
-- MRP or less lifts it.
alter table inventory
  add column if not exists hold_kind   text check (hold_kind in ('above_mrp', 'admin')),
  add column if not exists hold_reason text,
  add column if not exists held_at     timestamptz;

-- Manufacturer part number. The same component sold by two shops carries the same one, so it is the
-- strongest duplicate signal. The key ignores case, spaces and punctuation ("ATmega328P-PU" =
-- "atmega328p pu").
alter table products
  add column if not exists mpn text,
  add column if not exists mpn_key text generated always as (nullif(upper(regexp_replace(mpn, '[^A-Za-z0-9]', '', 'g')), '')) stored;
alter table product_submissions
  add column if not exists mpn text,
  add column if not exists mpn_key text generated always as (nullif(upper(regexp_replace(mpn, '[^A-Za-z0-9]', '', 'g')), '')) stored;

-- One catalog product per part number and brand; different makers can share a part number.
create unique index if not exists products_mpn_brand_key on products (mpn_key, lower(coalesce(brand, ''))) where mpn_key is not null;
create index if not exists product_submissions_mpn_idx on product_submissions (mpn_key) where mpn_key is not null;

-- One spelling per city for regional admin scopes: "Kanpur Nagar" = "kanpur", "Bangalore" =
-- "Bengaluru". Mirrors cityKey() in src/lib/city.ts; the city test checks they agree.
create or replace function sb_city_key(city text) returns text
language sql immutable parallel safe as $$
  with cleaned as (
    select btrim(regexp_replace(regexp_replace(lower(coalesce(city, '')), '[-.,()/0-9''_]', ' ', 'g'), '\s+', ' ', 'g')) as c
  ), base as (
    select case when c ~ '^.+ (nagar|city|district|urban)$' then regexp_replace(c, ' (nagar|city|district|urban)$', '') else c end as c
      from cleaned
  )
  select case c
    when 'bangalore' then 'bengaluru'
    when 'bombay' then 'mumbai'
    when 'madras' then 'chennai'
    when 'calcutta' then 'kolkata'
    when 'gurgaon' then 'gurugram'
    when 'new delhi' then 'delhi'
    when 'poona' then 'pune'
    when 'mysore' then 'mysuru'
    when 'baroda' then 'vadodara'
    when 'cawnpore' then 'kanpur'
    when 'banaras' then 'varanasi'
    when 'benares' then 'varanasi'
    when 'allahabad' then 'prayagraj'
    when 'vizag' then 'visakhapatnam'
    when 'cochin' then 'kochi'
    when 'trivandrum' then 'thiruvananthapuram'
    when 'pondicherry' then 'puducherry'
    when 'mangalore' then 'mangaluru'
    when 'belgaum' then 'belagavi'
    when 'gauhati' then 'guwahati'
    when 'simla' then 'shimla'
    when 'gautam buddha' then 'noida'
    else c end
  from base
$$;

-- Saved regions use the same spelling as the stores they are compared with.
update admin_members set regions = (select array_agg(distinct sb_city_key(r)) from unnest(regions) r)
 where regions is not null;
