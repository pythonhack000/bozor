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

