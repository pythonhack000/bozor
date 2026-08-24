-- topup_balance() was the pre-launch "demo balance" RPC: it credits the
-- caller's own balance (up to 100000) with no payment verification at all.
-- The real deposit flow (request_deposit -> admin_approve_deposit) replaced
-- it in the UI, but the RPC was still GRANTed to `authenticated`, so any
-- signed-up user could call it directly via the Supabase client/REST API
-- (bypassing the app entirely), mint fake balance, then cash it out via
-- request_withdrawal once KYC-verified. Revoke it so it can no longer be
-- invoked by clients; keep the function defined (harmless, admin-only via
-- SQL) in case it's ever wanted again for a sandboxed demo environment.
revoke execute on function public.topup_balance(numeric) from authenticated;
revoke execute on function public.topup_balance(numeric) from public;
