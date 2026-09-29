-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ROLES ENUM
create type user_role as enum ('customer', 'vendor', 'admin', 'rider');
create type vendor_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type order_status as enum ('placed', 'accepted', 'processing', 'ready_for_pickup', 'rider_assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled');

-- USERS TABLE (Extends Supabase Auth Users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role user_role not null default 'customer',
  full_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- VENDOR STORES TABLE
create table public.stores (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  store_name text not null,
  city text not null,
  status vendor_status default 'pending' not null,
  is_online boolean default false,
  commission_rate numeric(4,2) default 10.00, -- e.g. 10.00%
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- MASTER CATALOG (Managed by Admin)
create table public.master_products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  sku text unique not null,
  category text,
  description text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- VENDOR INVENTORY (Mapped to Master Catalog)
create table public.vendor_inventory (
  id uuid default uuid_generate_v4() primary key,
  store_id uuid references public.stores(id) on delete cascade not null,
  master_product_id uuid references public.master_products(id) on delete cascade not null,
  price numeric(10,2) not null,
  stock_quantity integer default 0 not null,
  is_active boolean default true,
  unique(store_id, master_product_id) -- A store can only have one listing per master product
);

-- ORDERS
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  customer_id uuid references public.profiles(id) not null,
  store_id uuid references public.stores(id) not null,
  rider_id uuid references public.profiles(id),
  status order_status default 'placed' not null,
  total_amount numeric(10,2) not null,
  delivery_fee numeric(10,2) not null,
  handover_pin text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ORDER ITEMS
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  inventory_id uuid references public.vendor_inventory(id) not null,
  quantity integer not null,
  price_at_time numeric(10,2) not null
);

-- RLS (Row Level Security) Policies
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.orders enable row level security;
alter table public.vendor_inventory enable row level security;

-- (Policies omitted for brevity, but they should restrict stores to their owners, orders to customers/vendors, etc.)
