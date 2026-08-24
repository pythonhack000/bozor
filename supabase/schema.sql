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
  buyer_last_read_at timestamptz,
  seller_last_read_at timestamptz,
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

-- Listing reports ("Пожаловаться")
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_listing_idx on public.reports(listing_id);

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
alter table public.reports enable row level security;

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

drop policy if exists "reporters can read own reports" on public.reports;
create policy "reporters can read own reports" on public.reports for select using (auth.uid() = reporter_id);

-- No client-side insert policy on reports either: only report_listing()
-- writes rows, and only admin_list_reports()/admin_resolve_report() (both
-- gated on profiles.is_admin) can see or act on the full open queue.

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

-- Adding p_buyer_note changes the function's signature (uuid) -> (uuid, text);
-- CREATE OR REPLACE would leave the old (uuid) overload behind as dead code,
-- so drop it explicitly first (no-op on reruns once it's gone).
drop function if exists public.purchase_listing(uuid);

create or replace function public.purchase_listing(p_listing_id uuid, p_buyer_note text default null)
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

  -- buyer_note carries e.g. a game ID for "donate"/top-up style listings, so
  -- the seller knows where to credit the top-up when they deliver the order.
  insert into public.orders (listing_id, buyer_id, seller_id, price, payment_method, status, buyer_note)
  values (p_listing_id, auth.uid(), v_listing.seller_id, v_listing.price, 'balance', 'paid',
          nullif(trim(coalesce(p_buyer_note, '')), ''))
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
  -- Buyer can only release funds after the seller has handed over the
  -- account via deliver_order() below — money is never released blind.
  if v_order.status <> 'delivered' then
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

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set buyer_last_read_at = case when buyer_id = auth.uid() then now() else buyer_last_read_at end,
        seller_last_read_at = case when seller_id = auth.uid() then now() else seller_last_read_at end
    where id = p_conversation_id and (buyer_id = auth.uid() or seller_id = auth.uid());
end;
$$;

revoke execute on function public.get_my_balance() from public;
revoke execute on function public.topup_balance(numeric) from public;
revoke execute on function public.purchase_listing(uuid, text) from public;
revoke execute on function public.confirm_order_receipt(uuid) from public;
revoke execute on function public.mark_conversation_read(uuid) from public;

grant execute on function public.get_my_balance() to authenticated;
grant execute on function public.purchase_listing(uuid, text) to authenticated;
grant execute on function public.confirm_order_receipt(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- topup_balance() is a leftover pre-launch "demo balance" RPC: it credits
-- the caller's own balance with no payment verification. The real deposit
-- flow (request_deposit -> admin_approve_deposit) replaced it in the UI, so
-- it must stay revoked from clients (see migration
-- 20260824132231_revoke_dead_demo_topup.sql) even though the function
-- definition is left in place.
revoke execute on function public.topup_balance(numeric) from authenticated;

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
  if v_order.status not in ('paid', 'delivered') then
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

-- Listing reports ("Пожаловаться")
create or replace function public.report_listing(p_listing_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_id uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason required';
  end if;
  if not exists (select 1 from public.listings where id = p_listing_id) then
    raise exception 'listing not found';
  end if;
  if exists (
    select 1 from public.reports
    where listing_id = p_listing_id and reporter_id = auth.uid() and status = 'open'
  ) then
    raise exception 'you already have an open report for this listing';
  end if;

  insert into public.reports (listing_id, reporter_id, reason)
  values (p_listing_id, auth.uid(), trim(p_reason))
  returning id into v_report_id;

  return v_report_id;
end;
$$;

create or replace function public.admin_list_reports()
returns table (
  id uuid,
  listing_id uuid,
  listing_title jsonb,
  listing_status text,
  reporter_name text,
  reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  return query
    select r.id, r.listing_id, l.title, l.status, rp.name, r.reason, r.created_at
    from public.reports r
    join public.listings l on l.id = r.listing_id
    join public.profiles rp on rp.id = r.reporter_id
    where r.status = 'open'
    order by r.created_at desc;
end;
$$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;
  if p_action not in ('dismiss', 'remove_listing') then
    raise exception 'invalid action';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found';
  end if;
  if v_report.status <> 'open' then
    raise exception 'report already handled';
  end if;

  if p_action = 'remove_listing' then
    update public.listings set status = 'rejected' where id = v_report.listing_id;
    update public.reports set status = 'resolved' where id = p_report_id;
  else
    update public.reports set status = 'dismissed' where id = p_report_id;
  end if;
end;
$$;

revoke execute on function public.report_listing(uuid, text) from public;
revoke execute on function public.admin_list_reports() from public;
revoke execute on function public.admin_resolve_report(uuid, text) from public;

grant execute on function public.report_listing(uuid, text) to authenticated;
grant execute on function public.admin_list_reports() to authenticated;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

-- Realtime for chat (idempotent: ALTER PUBLICATION ... ADD TABLE has no IF NOT
-- EXISTS form, so guard it manually — reruns would otherwise error with
-- "relation is already member of publication").
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ============================================================================
-- PAYMENTS: manual P2P deposits + withdrawals with admin approval
-- ============================================================================
-- Real money never moves inside the app. A buyer pays the operator off-platform
-- (Alif / DC / bank card / Binance-USDT), submits a deposit request with proof,
-- and an admin credits their balance after verifying the transfer arrived.
-- Sellers request withdrawals; the amount is held (deducted) immediately and the
-- admin pays them out off-platform, or rejects to refund the hold.

-- Operator payment details, editable in the admin panel. `details` holds the
-- requisites shown to the buyer (Alif number / card number / USDT address, ...).
create table if not exists public.payment_methods (
  code text primary key,                       -- 'alif' | 'dc' | 'card' | 'crypto'
  name jsonb not null,                         -- localized display name
  details text not null default '',            -- requisites shown to the buyer
  network text,                                -- e.g. 'TRC20' / 'BEP20' for crypto
  instructions jsonb,                          -- localized extra note (optional)
  min_amount numeric not null default 10,
  max_amount numeric not null default 100000,
  enabled boolean not null default false,      -- hidden until the operator fills details
  sort_order int not null default 0
);

-- Seed the four methods once; kept disabled until the operator adds requisites.
insert into public.payment_methods (code, name, network, min_amount, max_amount, enabled, sort_order)
values
  ('alif',  '{"ru":"Alif","tj":"Alif","en":"Alif"}'::jsonb,                                  null,    10, 50000,  false, 1),
  ('dc',    '{"ru":"DC кошелёк","tj":"Ҳамёни DC","en":"DC wallet"}'::jsonb,                  null,    10, 50000,  false, 2),
  ('card',  '{"ru":"Банковская карта","tj":"Корти бонкӣ","en":"Bank card"}'::jsonb,          null,    10, 50000,  false, 3),
  ('crypto','{"ru":"Binance / USDT","tj":"Binance / USDT","en":"Binance / USDT"}'::jsonb,    'TRC20', 10, 100000, false, 4)
on conflict (code) do nothing;

create table if not exists public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  method_code text not null references public.payment_methods(code),
  amount numeric not null check (amount > 0),
  reference_code text not null unique,         -- buyer includes this in the transfer note
  proof text,                                  -- txid / screenshot url / free-text note
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

create index if not exists deposit_requests_profile_idx on public.deposit_requests(profile_id, created_at desc);
create index if not exists deposit_requests_status_idx on public.deposit_requests(status, created_at desc);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  method_code text not null references public.payment_methods(code),
  amount numeric not null check (amount > 0),
  destination text not null,                   -- seller's own card / wallet / address
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

create index if not exists withdrawal_requests_profile_idx on public.withdrawal_requests(profile_id, created_at desc);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests(status, created_at desc);

-- Extend the wallet ledger with withdrawal events (idempotent: drop + recreate).
alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check
  check (type in ('topup', 'purchase_hold', 'purchase_release', 'refund', 'commission', 'withdrawal', 'withdrawal_refund'));

-- RLS
alter table public.payment_methods enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Only enabled methods are publicly visible; disabled ones are admin-only via RPC.
drop policy if exists "enabled payment methods are readable" on public.payment_methods;
create policy "enabled payment methods are readable" on public.payment_methods for select using (enabled = true);

-- Users read their own requests. All writes go through the security-definer
-- functions below (no client insert/update policy), so a client can never
-- fabricate an approved deposit or dodge the balance hold on a withdrawal.
drop policy if exists "users read own deposit requests" on public.deposit_requests;
create policy "users read own deposit requests" on public.deposit_requests for select using (auth.uid() = profile_id);

drop policy if exists "users read own withdrawal requests" on public.withdrawal_requests;
create policy "users read own withdrawal requests" on public.withdrawal_requests for select using (auth.uid() = profile_id);

-- Short human-readable reference code, e.g. "DEP-A1B2C3".
create or replace function public.gen_reference_code()
returns text
language sql
volatile
as $$
  select 'DEP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

-- Buyer opens a deposit request. Returns the created row (id + reference_code)
-- so the UI can show the reference the buyer must include in the transfer.
create or replace function public.request_deposit(p_method_code text, p_amount numeric, p_proof text default null)
returns table (id uuid, reference_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method public.payment_methods%rowtype;
  v_ref text;
  v_id uuid;
begin
  select * into v_method from public.payment_methods where code = p_method_code;
  if not found or not v_method.enabled then
    raise exception 'payment method not available';
  end if;
  if p_amount is null or p_amount < v_method.min_amount or p_amount > v_method.max_amount then
    raise exception 'amount out of range';
  end if;

  -- retry a couple of times in the astronomically unlikely event of a collision
  for i in 1..5 loop
    v_ref := public.gen_reference_code();
    exit when not exists (select 1 from public.deposit_requests d where d.reference_code = v_ref);
  end loop;

  insert into public.deposit_requests (profile_id, method_code, amount, reference_code, proof)
  values (auth.uid(), p_method_code, p_amount, v_ref, nullif(trim(coalesce(p_proof, '')), ''))
  returning deposit_requests.id, deposit_requests.reference_code into v_id, v_ref;

  return query select v_id, v_ref;
end;
$$;

-- Buyer attaches / updates proof (txid, screenshot link) on a pending request.
create or replace function public.submit_deposit_proof(p_id uuid, p_proof text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deposit_requests
    set proof = nullif(trim(coalesce(p_proof, '')), '')
    where id = p_id and profile_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'request not found or already processed';
  end if;
end;
$$;

-- Seller opens a withdrawal request. Holds (deducts) the amount immediately so
-- the balance can't be double-spent while the payout is pending.
create or replace function public.request_withdrawal(p_method_code text, p_amount numeric, p_destination text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method public.payment_methods%rowtype;
  v_balance numeric;
  v_id uuid;
begin
  select * into v_method from public.payment_methods where code = p_method_code;
  if not found or not v_method.enabled then
    raise exception 'payment method not available';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount';
  end if;
  if p_destination is null or length(trim(p_destination)) = 0 then
    raise exception 'destination required';
  end if;
  -- Cashing out real money requires an identity-verified (KYC-approved) seller.
  if not exists (select 1 from public.profiles where id = auth.uid() and verified) then
    raise exception 'seller verification required before withdrawing';
  end if;

  select balance into v_balance from public.profiles where id = auth.uid() for update;
  if v_balance is null then
    raise exception 'profile not found';
  end if;
  if v_balance < p_amount then
    raise exception 'insufficient balance';
  end if;

  update public.profiles set balance = balance - p_amount where id = auth.uid();

  insert into public.withdrawal_requests (profile_id, method_code, amount, destination)
  values (auth.uid(), p_method_code, p_amount, trim(p_destination))
  returning id into v_id;

  insert into public.wallet_transactions (profile_id, amount, type)
  values (auth.uid(), -p_amount, 'withdrawal');

  return v_id;
end;
$$;

-- Admin: pending deposit queue with requester name + method label.
create or replace function public.admin_list_deposits()
returns table (
  id uuid,
  profile_id uuid,
  user_name text,
  method_code text,
  method_name jsonb,
  amount numeric,
  reference_code text,
  proof text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  return query
    select d.id, d.profile_id, pr.name, d.method_code, pm.name, d.amount, d.reference_code, d.proof, d.created_at
    from public.deposit_requests d
    join public.profiles pr on pr.id = d.profile_id
    join public.payment_methods pm on pm.code = d.method_code
    where d.status = 'pending'
    order by d.created_at asc;
end;
$$;

create or replace function public.admin_approve_deposit(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.deposit_requests%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  select * into v_req from public.deposit_requests where id = p_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request already processed';
  end if;

  update public.profiles set balance = balance + v_req.amount where id = v_req.profile_id;
  insert into public.wallet_transactions (profile_id, amount, type)
  values (v_req.profile_id, v_req.amount, 'topup');

  update public.deposit_requests
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = p_id;
end;
$$;

create or replace function public.admin_reject_deposit(p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  update public.deposit_requests
    set status = 'rejected', admin_note = nullif(trim(coalesce(p_note, '')), ''),
        decided_at = now(), decided_by = auth.uid()
    where id = p_id and status = 'pending';
  if not found then
    raise exception 'request not found or already processed';
  end if;
end;
$$;

create or replace function public.admin_list_withdrawals()
returns table (
  id uuid,
  profile_id uuid,
  user_name text,
  method_code text,
  method_name jsonb,
  amount numeric,
  destination text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  return query
    select w.id, w.profile_id, pr.name, w.method_code, pm.name, w.amount, w.destination, w.created_at
    from public.withdrawal_requests w
    join public.profiles pr on pr.id = w.profile_id
    join public.payment_methods pm on pm.code = w.method_code
    where w.status = 'pending'
    order by w.created_at asc;
end;
$$;

-- Approve = payout was sent off-platform; the hold stays deducted.
create or replace function public.admin_approve_withdrawal(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  update public.withdrawal_requests
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = p_id and status = 'pending';
  if not found then
    raise exception 'request not found or already processed';
  end if;
end;
$$;

-- Reject = refund the held amount back to the seller's balance.
create or replace function public.admin_reject_withdrawal(p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.withdrawal_requests%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  select * into v_req from public.withdrawal_requests where id = p_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request already processed';
  end if;

  update public.profiles set balance = balance + v_req.amount where id = v_req.profile_id;
  insert into public.wallet_transactions (profile_id, amount, type)
  values (v_req.profile_id, v_req.amount, 'withdrawal_refund');

  update public.withdrawal_requests
    set status = 'rejected', admin_note = nullif(trim(coalesce(p_note, '')), ''),
        decided_at = now(), decided_by = auth.uid()
    where id = p_id;
end;
$$;

-- Admin: full method list (incl. disabled) for the requisites editor.
create or replace function public.admin_list_payment_methods()
returns setof public.payment_methods
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;
  return query select * from public.payment_methods order by sort_order;
end;
$$;

create or replace function public.admin_update_payment_method(
  p_code text,
  p_details text,
  p_network text,
  p_min_amount numeric,
  p_max_amount numeric,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;
  if p_min_amount is null or p_max_amount is null or p_min_amount <= 0 or p_max_amount < p_min_amount then
    raise exception 'invalid amount range';
  end if;

  update public.payment_methods
    set details = coalesce(trim(p_details), ''),
        network = nullif(trim(coalesce(p_network, '')), ''),
        min_amount = p_min_amount,
        max_amount = p_max_amount,
        enabled = coalesce(p_enabled, false)
    where code = p_code;
  if not found then
    raise exception 'method not found';
  end if;
end;
$$;

-- Lock down execute grants (RPC-only writes).
revoke execute on function public.request_deposit(text, numeric, text) from public;
revoke execute on function public.submit_deposit_proof(uuid, text) from public;
revoke execute on function public.request_withdrawal(text, numeric, text) from public;
revoke execute on function public.admin_list_deposits() from public;
revoke execute on function public.admin_approve_deposit(uuid) from public;
revoke execute on function public.admin_reject_deposit(uuid, text) from public;
revoke execute on function public.admin_list_withdrawals() from public;
revoke execute on function public.admin_approve_withdrawal(uuid) from public;
revoke execute on function public.admin_reject_withdrawal(uuid, text) from public;
revoke execute on function public.admin_list_payment_methods() from public;
revoke execute on function public.admin_update_payment_method(text, text, text, numeric, numeric, boolean) from public;

grant execute on function public.request_deposit(text, numeric, text) to authenticated;
grant execute on function public.submit_deposit_proof(uuid, text) to authenticated;
grant execute on function public.request_withdrawal(text, numeric, text) to authenticated;
grant execute on function public.admin_list_deposits() to authenticated;
grant execute on function public.admin_approve_deposit(uuid) to authenticated;
grant execute on function public.admin_reject_deposit(uuid, text) to authenticated;
grant execute on function public.admin_list_withdrawals() to authenticated;
grant execute on function public.admin_approve_withdrawal(uuid) to authenticated;
grant execute on function public.admin_reject_withdrawal(uuid, text) to authenticated;
grant execute on function public.admin_list_payment_methods() to authenticated;
grant execute on function public.admin_update_payment_method(text, text, text, numeric, numeric, boolean) to authenticated;

-- ============================================================================
-- ORDER HANDOFF: explicit seller "delivered the account" step
-- ============================================================================
-- Money stays held from purchase_listing() (status 'paid') until the seller
-- actively hands the account over through the platform (status 'delivered')
-- and the buyer confirms (confirm_order_receipt -> 'released'). The buyer
-- never has to trust a blind release, and the seller never hands over
-- credentials without a paid, locked-in order already existing.

alter table public.orders add column if not exists credentials text;
alter table public.orders add column if not exists buyer_note text;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('paid', 'delivered', 'released', 'disputed', 'refunded'));

-- Seller hands over the account. `credentials` is only ever readable by the
-- buyer/seller of this order (orders SELECT policy is row-level, scoped to
-- auth.uid() in (buyer_id, seller_id)), and only becomes non-null once the
-- seller submits it here — so the buyer can't see it before this point.
create or replace function public.deliver_order(p_order_id uuid, p_credentials text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_credentials is null or length(trim(p_credentials)) = 0 then
    raise exception 'account credentials required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  if v_order.seller_id <> auth.uid() then
    raise exception 'not your order';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'order not in a deliverable state';
  end if;

  update public.orders set credentials = trim(p_credentials), status = 'delivered' where id = p_order_id;
end;
$$;

revoke execute on function public.deliver_order(uuid, text) from public;
grant execute on function public.deliver_order(uuid, text) to authenticated;

-- Only identity-verified sellers may list accounts for sale.
drop policy if exists "authenticated users can create listings" on public.listings;
drop policy if exists "verified sellers can create listings" on public.listings;
create policy "verified sellers can create listings" on public.listings for insert with check (
  auth.uid() = seller_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.verified = true)
);

-- ============================================================================
-- KYC: passport identity verification, required for sellers
-- ============================================================================
-- Reuses profiles.verified as the single "trusted seller" flag (already shown
-- everywhere in the UI via VerifiedBadge). Approval here is what flips it on;
-- nothing else may.

create table if not exists public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  passport_number text not null,
  document_path text not null,        -- path in the private 'kyc-documents' storage bucket
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

create index if not exists kyc_submissions_profile_idx on public.kyc_submissions(profile_id, created_at desc);
create index if not exists kyc_submissions_status_idx on public.kyc_submissions(status, created_at desc);

alter table public.kyc_submissions enable row level security;

drop policy if exists "users read own kyc submissions" on public.kyc_submissions;
create policy "users read own kyc submissions" on public.kyc_submissions for select using (auth.uid() = profile_id);

-- All writes go through the functions below (no client insert/update policy):
-- a raw insert policy would let a client fabricate an 'approved' row.

create or replace function public.submit_kyc(p_full_name text, p_passport_number text, p_document_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'full name required';
  end if;
  if p_passport_number is null or length(trim(p_passport_number)) = 0 then
    raise exception 'passport number required';
  end if;
  if p_document_path is null or length(trim(p_document_path)) = 0 then
    raise exception 'document required';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and verified) then
    raise exception 'already verified';
  end if;
  if exists (select 1 from public.kyc_submissions where profile_id = auth.uid() and status = 'pending') then
    raise exception 'you already have a pending verification request';
  end if;

  insert into public.kyc_submissions (profile_id, full_name, passport_number, document_path)
  values (auth.uid(), trim(p_full_name), trim(p_passport_number), p_document_path)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_list_kyc()
returns table (
  id uuid,
  profile_id uuid,
  user_name text,
  full_name text,
  passport_number text,
  document_path text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  return query
    select k.id, k.profile_id, pr.name, k.full_name, k.passport_number, k.document_path, k.created_at
    from public.kyc_submissions k
    join public.profiles pr on pr.id = k.profile_id
    where k.status = 'pending'
    order by k.created_at asc;
end;
$$;

create or replace function public.admin_approve_kyc(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.kyc_submissions%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  select * into v_sub from public.kyc_submissions where id = p_id for update;
  if not found then
    raise exception 'submission not found';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'submission already processed';
  end if;

  update public.profiles set verified = true where id = v_sub.profile_id;
  update public.kyc_submissions
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = p_id;
end;
$$;

create or replace function public.admin_reject_kyc(p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;

  update public.kyc_submissions
    set status = 'rejected', admin_note = nullif(trim(coalesce(p_note, '')), ''),
        decided_at = now(), decided_by = auth.uid()
    where id = p_id and status = 'pending';
  if not found then
    raise exception 'submission not found or already processed';
  end if;
end;
$$;

revoke execute on function public.submit_kyc(text, text, text) from public;
revoke execute on function public.admin_list_kyc() from public;
revoke execute on function public.admin_approve_kyc(uuid) from public;
revoke execute on function public.admin_reject_kyc(uuid, text) from public;

grant execute on function public.submit_kyc(text, text, text) to authenticated;
grant execute on function public.admin_list_kyc() to authenticated;
grant execute on function public.admin_approve_kyc(uuid) to authenticated;
grant execute on function public.admin_reject_kyc(uuid, text) to authenticated;

-- Private storage bucket for passport photos: users can only write/read their
-- own folder (path prefixed with their own auth.uid()); admins can read any
-- object in the bucket to review submissions. Nobody else can read it (no
-- public policy, bucket is private).
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

drop policy if exists "users upload own kyc docs" on storage.objects;
create policy "users upload own kyc docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users read own kyc docs" on storage.objects;
create policy "users read own kyc docs" on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "admins read all kyc docs" on storage.objects;
create policy "admins read all kyc docs" on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ============================================================================
-- LISTING KIND: accounts vs. donate/top-up (in-game currency) offers
-- ============================================================================
-- A "topup" listing (e.g. "PUBG Mobile 660 UC") is delivered the same way as
-- an account (via deliver_order after the buyer_note/game-ID they left at
-- purchase), it just isn't a set of login credentials. Same escrow, same
-- categories — only the label and what the buyer is asked for differ.

alter table public.listings add column if not exists kind text not null default 'account';

alter table public.listings drop constraint if exists listings_kind_check;
alter table public.listings add constraint listings_kind_check check (kind in ('account', 'topup'));

-- ============================================================================
-- OFFICIAL DONATE STORE: only the operator (admin) sells "topup" listings
-- ============================================================================
-- Regular verified sellers can only list accounts ('account'). In-game
-- top-ups ('topup') are fulfilled directly by the platform as an official
-- store, so only an admin profile may create one. This replaces the earlier
-- "verified sellers can create listings" insert policy.

drop policy if exists "verified sellers can create listings" on public.listings;
drop policy if exists "sellers can create listings" on public.listings;
create policy "sellers can create listings" on public.listings for insert with check (
  auth.uid() = seller_id and (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
    or (kind = 'account' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.verified = true))
  )
);

-- ============================================================================
-- ADMIN LISTING DELETION: hard delete any listing, with a required reason
-- ============================================================================
-- Sellers can already delete their own listings directly (RLS policy
-- "sellers can delete own listings" above, table delete via the client).
-- This adds moderator power to remove *any* listing, always with a reason,
-- and keeps a lightweight audit trail (the listing row itself is gone after
-- this, so the snapshot here is the only record of what/why).

create table if not exists public.listing_deletions (
  id uuid primary key default gen_random_uuid(),
  listing_title jsonb,
  seller_id uuid,
  price numeric,
  reason text not null,
  deleted_by uuid references public.profiles(id),
  deleted_at timestamptz not null default now()
);

alter table public.listing_deletions enable row level security;

drop policy if exists "admins read listing deletions" on public.listing_deletions;
create policy "admins read listing deletions" on public.listing_deletions for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);
-- No insert policy: only admin_delete_listing() below writes rows.

create or replace function public.admin_delete_listing(p_listing_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'not authorized';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason required';
  end if;

  select * into v_listing from public.listings where id = p_listing_id;
  if not found then
    raise exception 'listing not found';
  end if;

  insert into public.listing_deletions (listing_title, seller_id, price, reason, deleted_by)
  values (v_listing.title, v_listing.seller_id, v_listing.price, trim(p_reason), auth.uid());

  delete from public.listings where id = p_listing_id;
end;
$$;

revoke execute on function public.admin_delete_listing(uuid, text) from public;
grant execute on function public.admin_delete_listing(uuid, text) to authenticated;

