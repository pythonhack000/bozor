-- ============================================================================
-- 1) Deposit proof screenshots: private storage bucket (same pattern as
--    kyc-documents) so buyers attach a real file instead of pasting a link.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('deposit-proofs', 'deposit-proofs', false)
on conflict (id) do nothing;

drop policy if exists "users upload own deposit proofs" on storage.objects;
create policy "users upload own deposit proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'deposit-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users read own deposit proofs" on storage.objects;
create policy "users read own deposit proofs" on storage.objects for select to authenticated
  using (bucket_id = 'deposit-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "admins read all deposit proofs" on storage.objects;
create policy "admins read all deposit proofs" on storage.objects for select to authenticated
  using (
    bucket_id = 'deposit-proofs'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ============================================================================
-- 2) Admin deposit/withdrawal history: the list RPCs only ever returned the
--    pending queue, so once a request was approved/rejected it vanished from
--    the admin's view with no record. Now returns every request (newest
--    first); the client splits pending (actionable) from history (read-only).
--    Return type is changing (new columns), so DROP + CREATE, not REPLACE.
-- ============================================================================
alter table public.deposit_requests add column if not exists credited_amount numeric;

drop function if exists public.admin_list_deposits();
create function public.admin_list_deposits()
returns table (
  id uuid,
  profile_id uuid,
  user_name text,
  method_code text,
  method_name jsonb,
  amount numeric,
  credited_amount numeric,
  currency text,
  reference_code text,
  proof text,
  status text,
  admin_note text,
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
    select d.id, d.profile_id, pr.name, d.method_code, pm.name, d.amount, d.credited_amount,
           pm.currency, d.reference_code, d.proof, d.status, d.admin_note, d.created_at
    from public.deposit_requests d
    join public.profiles pr on pr.id = d.profile_id
    join public.payment_methods pm on pm.code = d.method_code
    order by (d.status = 'pending') desc, d.created_at desc;
end;
$$;

drop function if exists public.admin_list_withdrawals();
create function public.admin_list_withdrawals()
returns table (
  id uuid,
  profile_id uuid,
  user_name text,
  method_code text,
  method_name jsonb,
  amount numeric,
  destination text,
  status text,
  admin_note text,
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
    select w.id, w.profile_id, pr.name, w.method_code, pm.name, w.amount, w.destination,
           w.status, w.admin_note, w.created_at
    from public.withdrawal_requests w
    join public.profiles pr on pr.id = w.profile_id
    join public.payment_methods pm on pm.code = w.method_code
    order by (w.status = 'pending') desc, w.created_at desc;
end;
$$;

revoke execute on function public.admin_list_deposits() from public;
revoke execute on function public.admin_list_withdrawals() from public;
grant execute on function public.admin_list_deposits() to authenticated;
grant execute on function public.admin_list_withdrawals() to authenticated;

-- ============================================================================
-- 3) Crypto deposits: buyer types the amount in the coin's own currency
--    (USDT/USDC), not smn. There's no live FX feed, so the admin enters the
--    actual smn amount to credit at approval time — p_credit_amount overrides
--    the requested figure; omitted (the TJS-method path), it credits exactly
--    what was requested like before.
-- ============================================================================
alter table public.payment_methods add column if not exists currency text not null default 'TJS';
update public.payment_methods set currency = 'USDT' where code in ('crypto', 'crypto_bep20');
update public.payment_methods set currency = 'USDC' where code = 'crypto_sol';

-- CREATE OR REPLACE with an added parameter leaves the old (uuid)-only
-- overload in place as dead code AND makes calls with just {p_id} ambiguous
-- between the two overloads — drop it first (no-op on reruns once it's gone).
drop function if exists public.admin_approve_deposit(uuid);

create or replace function public.admin_approve_deposit(p_id uuid, p_credit_amount numeric default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.deposit_requests%rowtype;
  v_credit numeric;
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

  v_credit := coalesce(p_credit_amount, v_req.amount);
  if v_credit <= 0 then
    raise exception 'invalid credit amount';
  end if;

  update public.profiles set balance = balance + v_credit where id = v_req.profile_id;
  insert into public.wallet_transactions (profile_id, amount, type)
  values (v_req.profile_id, v_credit, 'topup');

  update public.deposit_requests
    set status = 'approved', credited_amount = v_credit, decided_at = now(), decided_by = auth.uid()
    where id = p_id;
end;
$$;

revoke execute on function public.admin_approve_deposit(uuid, numeric) from public;
grant execute on function public.admin_approve_deposit(uuid, numeric) to authenticated;

-- ============================================================================
-- 4) Realtime: the admin panel only ever loaded its queues once on mount.
--    Add the moderation-relevant tables to the realtime publication so
--    AdminView can subscribe and refresh as new requests come in.
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deposit_requests'
  ) then
    alter publication supabase_realtime add table public.deposit_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'withdrawal_requests'
  ) then
    alter publication supabase_realtime add table public.withdrawal_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kyc_submissions'
  ) then
    alter publication supabase_realtime add table public.kyc_submissions;
  end if;
end $$;
