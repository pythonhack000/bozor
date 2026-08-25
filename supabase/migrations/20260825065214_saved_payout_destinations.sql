-- Remembers a seller's own payout destination per withdrawal method, so
-- request_withdrawal doesn't require retyping the same wallet/card number
-- every time — the client pre-fills it and request_withdrawal keeps it
-- fresh on every use.
create table if not exists public.payout_destinations (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  method_code text not null references public.payment_methods(code),
  destination text not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, method_code)
);

alter table public.payout_destinations enable row level security;

drop policy if exists "users manage own payout destinations" on public.payout_destinations;
create policy "users manage own payout destinations" on public.payout_destinations for select using (auth.uid() = profile_id);

-- Writes only ever happen through request_withdrawal() (security definer),
-- never directly from the client, so no insert/update policy is needed.

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

  insert into public.payout_destinations (profile_id, method_code, destination)
  values (auth.uid(), p_method_code, trim(p_destination))
  on conflict (profile_id, method_code) do update set destination = excluded.destination, updated_at = now();

  return v_id;
end;
$$;
