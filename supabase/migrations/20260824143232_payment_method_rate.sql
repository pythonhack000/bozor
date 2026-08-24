-- Admin sets a smn-per-unit exchange rate once per crypto method (in
-- Реквизиты), instead of typing the credit amount from scratch on every
-- deposit. admin_list_deposits now also returns the method's rate so the
-- client can pre-fill (still editable) the credit-amount field.
alter table public.payment_methods add column if not exists rate numeric;

-- CREATE OR REPLACE with an added parameter leaves the old lower-arity
-- overload in place as dead code and makes calls with the old argument list
-- ambiguous between the two — drop it first (no-op on reruns once it's gone).
drop function if exists public.admin_update_payment_method(text, text, text, numeric, numeric, boolean);

create function public.admin_update_payment_method(
  p_code text,
  p_details text,
  p_network text,
  p_min_amount numeric,
  p_max_amount numeric,
  p_enabled boolean,
  p_rate numeric default null
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
  if p_rate is not null and p_rate <= 0 then
    raise exception 'invalid rate';
  end if;

  update public.payment_methods
    set details = coalesce(trim(p_details), ''),
        network = nullif(trim(coalesce(p_network, '')), ''),
        min_amount = p_min_amount,
        max_amount = p_max_amount,
        enabled = coalesce(p_enabled, false),
        rate = p_rate
    where code = p_code;
  if not found then
    raise exception 'method not found';
  end if;
end;
$$;

revoke execute on function public.admin_update_payment_method(text, text, text, numeric, numeric, boolean, numeric) from public;
grant execute on function public.admin_update_payment_method(text, text, text, numeric, numeric, boolean, numeric) to authenticated;

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
  rate numeric,
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
           pm.currency, pm.rate, d.reference_code, d.proof, d.status, d.admin_note, d.created_at
    from public.deposit_requests d
    join public.profiles pr on pr.id = d.profile_id
    join public.payment_methods pm on pm.code = d.method_code
    order by (d.status = 'pending') desc, d.created_at desc;
end;
$$;

revoke execute on function public.admin_list_deposits() from public;
grant execute on function public.admin_list_deposits() to authenticated;
