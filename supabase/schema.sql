-- AccBozor schema

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  city text,
  verified boolean not null default false,
  online boolean not null default true,
  response_time_minutes int not null default 30,
  rating numeric(2,1) not null default 5.0,
  reviews_count int not null default 0,
  sales_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Categories (fixed catalog, seeded once)
create table if not exists public.categories (
  slug text primary key,
  name jsonb not null,
  image text not null,
  image_fit text not null default 'cover',
  color text not null,
  sort_order int not null default 0
);

-- Listings
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references public.categories(slug),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title jsonb not null,
  description jsonb not null,
  price numeric not null check (price > 0),
  old_price numeric,
  delivery text not null default 'manual' check (delivery in ('instant', 'manual')),
  server text,
  level int,
  attrs jsonb not null default '[]',
  images text[] not null default '{}',
  status text not null default 'active' check (status in ('pending', 'active', 'sold', 'rejected')),
  views int not null default 0,
  favorites int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists listings_category_idx on public.listings(category_slug);
create index if not exists listings_seller_idx on public.listings(seller_id);

-- Reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  text jsonb not null,
  created_at timestamptz not null default now()
);

-- Conversations + messages
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (buyer_id, seller_id, listing_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

-- Orders (mock escrow)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  price numeric not null,
  payment_method text,
  status text not null default 'paid' check (status in ('paid', 'released', 'disputed', 'refunded')),
  created_at timestamptz not null default now()
);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.reviews enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.orders enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable" on public.profiles for select using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "categories are publicly readable" on public.categories;
create policy "categories are publicly readable" on public.categories for select using (true);

drop policy if exists "listings are publicly readable" on public.listings;
create policy "listings are publicly readable" on public.listings for select using (true);

drop policy if exists "authenticated users can create listings" on public.listings;
create policy "authenticated users can create listings" on public.listings for insert with check (auth.uid() = seller_id);

drop policy if exists "sellers can update own listings" on public.listings;
create policy "sellers can update own listings" on public.listings for update using (auth.uid() = seller_id);

drop policy if exists "sellers can delete own listings" on public.listings;
create policy "sellers can delete own listings" on public.listings for delete using (auth.uid() = seller_id);

drop policy if exists "reviews are publicly readable" on public.reviews;
create policy "reviews are publicly readable" on public.reviews for select using (true);

drop policy if exists "authenticated users can create reviews" on public.reviews;
create policy "authenticated users can create reviews" on public.reviews for insert with check (auth.uid() = author_id);

drop policy if exists "participants can read conversations" on public.conversations;
create policy "participants can read conversations" on public.conversations for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "authenticated users can create conversations" on public.conversations;
create policy "authenticated users can create conversations" on public.conversations for insert with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "participants can read messages" on public.messages;
create policy "participants can read messages" on public.messages for select using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "participants can send messages" on public.messages;
create policy "participants can send messages" on public.messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

drop policy if exists "participants can read orders" on public.orders;
create policy "participants can read orders" on public.orders for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "buyers can create orders" on public.orders;
create policy "buyers can create orders" on public.orders for insert with check (auth.uid() = buyer_id);

-- Realtime for chat
alter publication supabase_realtime add table public.messages;
