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
  rating numeric(2,1) not null default 0,
  reviews_count int not null default 0,
  sales_count int not null default 0,
  balance numeric not null default 0,
  is_admin boolean not null default false,
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

-- Orders (real escrow backed by profiles.balance)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  price numeric not null,
  payment_method text,
  status text not null default 'paid' check (status in ('paid', 'released', 'disputed', 'refunded')),
  dispute_reason text,
  dispute_opened_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Wallet ledger: one row per balance-affecting event
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  type text not null check (type in ('topup', 'purchase_hold', 'purchase_release', 'refund', 'commission')),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_profile_idx on public.wallet_transactions(profile_id, created_at desc);

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
alter table public.wallet_transactions enable row level security;

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

-- No client-side insert policy on reviews: rows are only ever written by
-- create_review() below, which verifies the author has a released order
-- for the listing before allowing a review (and updates the seller's
-- rating/reviews_count atomically). A raw insert policy here would let
-- anyone post a review for anything they never bought.
drop policy if exists "authenticated users can create reviews" on public.reviews;

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

-- No client-side insert/update policy on orders: rows are only ever written
-- by the security-definer functions below (purchase_listing, confirm_order_receipt),
-- which run as the table owner and enforce the balance checks atomically.
-- Do not add a "buyers can create orders" insert policy — it would let a
-- client fabricate a 'paid' order without actually moving any balance.
drop policy if exists "buyers can create orders" on public.orders;

drop policy if exists "users can read own transactions" on public.wallet_transactions;
create policy "users can read own transactions" on public.wallet_transactions for select using (auth.uid() = profile_id);

-- Lock down direct client writes/reads on sensitive profile columns.
-- All balance/rating/sales mutations and balance reads must go through the
-- security-definer functions below, which run as the table owner and
-- bypass these grants.
--
-- IMPORTANT: a column-level REVOKE does NOT override the table-level
-- "GRANT ALL ON ALL TABLES IN SCHEMA public" that Supabase applies by
-- default (information_schema.column_privileges will keep showing the
-- column as grantable until the table-level grant itself is revoked).
-- Confirmed via a live PATCH against /rest/v1/profiles that a
-- column-level-only revoke silently does nothing — the table-level grant
-- must be revoked and only the safe columns re-granted.
revoke update on public.profiles from anon, authenticated;
grant update (name, city, online, response_time_minutes) on public.profiles to authenticated;

revoke select on public.profiles from anon, authenticated;
grant select (id, name, city, verified, online, response_time_minutes, rating, reviews_count, sales_count, created_at, is_admin)
  on public.profiles to anon, authenticated;

create or replace function public.get_my_balance()
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(balance, 0) from public.profiles where id = auth.uid();
$$;

create or replace function public.topup_balance(p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'invalid amount';
  end if;

  update public.profiles set balance = balance + p_amount where id = auth.uid()
  returning balance into v_balance;

  insert into public.wallet_transactions (profile_id, amount, type)
  values (auth.uid(), p_amount, 'topup');

  return v_balance;
end;
$$;

create or replace function public.purchase_listing(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_balance numeric;
  v_order_id uuid;
begin
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing not found';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'listing not available';
  end if;
  if v_listing.seller_id = auth.uid() then
    raise exception 'cannot buy own listing';
  end if;

  select balance into v_balance from public.profiles where id = auth.uid() for update;
  if v_balance is null then
    raise exception 'profile not found';
  end if;
  if v_balance < v_listing.price then
    raise exception 'insufficient balance';
  end if;

  update public.profiles set balance = balance - v_listing.price where id = auth.uid();
  update public.listings set status = 'sold' where id = p_listing_id;

  insert into public.orders (listing_id, buyer_id, seller_id, price, payment_method, status)
  values (p_listing_id, auth.uid(), v_listing.seller_id, v_listing.price, 'balance', 'paid')
  returning id into v_order_id;

  insert into public.wallet_transactions (profile_id, amount, type, order_id)
  values (auth.uid(), -v_listing.price, 'purchase_hold', v_order_id);

  return v_order_id;
end;
$$;

create or replace function public.commission_rate()
returns numeric
language sql
immutable
as $$
  select 0.10;
$$;

create or replace function public.confirm_order_receipt(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_commission numeric;
  v_net numeric;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  if v_order.buyer_id <> auth.uid() then
    raise exception 'not your order';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'order not in a confirmable state';
  end if;

  v_commission := round(v_order.price * public.commission_rate(), 2);
  v_net := v_order.price - v_commission;

  update public.orders set status = 'released' where id = p_order_id;
  update public.profiles
    set balance = balance + v_net, sales_count = sales_count + 1
    where id = v_order.seller_id;

  insert into public.wallet_transactions (profile_id, amount, type, order_id)
  values (v_order.seller_id, v_net, 'purchase_release', p_order_id);
  insert into public.wallet_transactions (profile_id, amount, type, order_id)
  values (v_order.seller_id, -v_commission, 'commission', p_order_id);
end;
$$;

revoke execute on function public.get_my_balance() from public;
revoke execute on function public.topup_balance(numeric) from public;
revoke execute on function public.purchase_listing(uuid) from public;
revoke execute on function public.confirm_order_receipt(uuid) from public;

grant execute on function public.get_my_balance() to authenticated;
grant execute on function public.topup_balance(numeric) to authenticated;
grant execute on function public.purchase_listing(uuid) to authenticated;
grant execute on function public.confirm_order_receipt(uuid) to authenticated;

-- Dispute / arbitration
-- (is_admin is already excluded from the UPDATE grant list above, so no
-- client can self-promote to admin)

create or replace function public.open_dispute(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  if auth.uid() not in (v_order.buyer_id, v_order.seller_id) then
    raise exception 'not a participant of this order';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'order not in a disputable state';
  end if;

  update public.orders
    set status = 'disputed', dispute_reason = p_reason, dispute_opened_by = auth.uid()
    where id = p_order_id;
end;
$$;

create or replace function public.admin_list_disputed_orders()
returns table (
  id uuid,
  listing_title jsonb,
  price numeric,
  buyer_id uuid,
  buyer_name text,
  seller_id uuid,
  seller_name text,
  dispute_reason text,
  dispute_opened_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- "p" alias is required here, not cosmetic: this function's RETURNS TABLE
  -- declares an OUT parameter named "id", which shadows a bare "id" column
  -- reference inside the function body ("column reference is ambiguous").
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  return query
    select o.id, l.title, o.price, o.buyer_id, bp.name, o.seller_id, sp.name,
           o.dispute_reason, o.dispute_opened_by, o.created_at
    from public.orders o
    left join public.listings l on l.id = o.listing_id
    join public.profiles bp on bp.id = o.buyer_id
    join public.profiles sp on sp.id = o.seller_id
    where o.status = 'disputed'
    order by o.created_at desc;
end;
$$;

create or replace function public.admin_resolve_dispute(p_order_id uuid, p_resolution text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_commission numeric;
  v_net numeric;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;
  if p_resolution not in ('refund_buyer', 'release_seller') then
    raise exception 'invalid resolution';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  if v_order.status <> 'disputed' then
    raise exception 'order not in a disputed state';
  end if;

  if p_resolution = 'refund_buyer' then
    update public.profiles set balance = balance + v_order.price where id = v_order.buyer_id;
    update public.orders set status = 'refunded' where id = p_order_id;
    insert into public.wallet_transactions (profile_id, amount, type, order_id)
    values (v_order.buyer_id, v_order.price, 'refund', p_order_id);
  else
    v_commission := round(v_order.price * public.commission_rate(), 2);
    v_net := v_order.price - v_commission;

    update public.profiles
      set balance = balance + v_net, sales_count = sales_count + 1
      where id = v_order.seller_id;
    update public.orders set status = 'released' where id = p_order_id;
    insert into public.wallet_transactions (profile_id, amount, type, order_id)
    values (v_order.seller_id, v_net, 'purchase_release', p_order_id);
    insert into public.wallet_transactions (profile_id, amount, type, order_id)
    values (v_order.seller_id, -v_commission, 'commission', p_order_id);
  end if;
end;
$$;

revoke execute on function public.open_dispute(uuid, text) from public;
revoke execute on function public.admin_list_disputed_orders() from public;
revoke execute on function public.admin_resolve_dispute(uuid, text) from public;

grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.admin_list_disputed_orders() to authenticated;
grant execute on function public.admin_resolve_dispute(uuid, text) to authenticated;

-- Reviews: only buyers with a released order for the listing may review it,
-- once per listing. Recomputes the seller's aggregate rating/reviews_count.
create or replace function public.create_review(p_listing_id uuid, p_rating int, p_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_has_purchase boolean;
  v_review_id uuid;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'invalid rating';
  end if;
  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'review text required';
  end if;

  select * into v_listing from public.listings where id = p_listing_id;
  if not found then
    raise exception 'listing not found';
  end if;

  select exists(
    select 1 from public.orders o
    where o.listing_id = p_listing_id and o.buyer_id = auth.uid() and o.status = 'released'
  ) into v_has_purchase;
  if not v_has_purchase then
    raise exception 'you can only review listings you have purchased and received';
  end if;

  if exists (select 1 from public.reviews where listing_id = p_listing_id and author_id = auth.uid()) then
    raise exception 'you have already reviewed this listing';
  end if;

  insert into public.reviews (listing_id, author_id, rating, text)
  values (p_listing_id, auth.uid(), p_rating, jsonb_build_object('ru', p_text, 'tj', p_text, 'en', p_text))
  returning id into v_review_id;

  update public.profiles
    set rating = (
          select round(avg(r.rating)::numeric, 1)
          from public.reviews r
          join public.listings l on l.id = r.listing_id
          where l.seller_id = v_listing.seller_id
        ),
        reviews_count = (
          select count(*)
          from public.reviews r
          join public.listings l on l.id = r.listing_id
          where l.seller_id = v_listing.seller_id
        )
    where id = v_listing.seller_id;

  return v_review_id;
end;
$$;

revoke execute on function public.create_review(uuid, int, text) from public;
grant execute on function public.create_review(uuid, int, text) to authenticated;

-- Realtime for chat
alter publication supabase_realtime add table public.messages;
