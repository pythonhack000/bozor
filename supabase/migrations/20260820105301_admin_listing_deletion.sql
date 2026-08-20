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

