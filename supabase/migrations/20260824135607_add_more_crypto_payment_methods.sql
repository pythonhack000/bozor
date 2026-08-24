-- Operator has separate Binance deposit addresses per network (TRC20 already
-- exists as 'crypto'). Add two more method rows so the admin panel has
-- fields for them too. Structure only — left disabled with empty details;
-- the operator fills in the actual address themselves in /admin, same as
-- the original four.
insert into public.payment_methods (code, name, network, min_amount, max_amount, enabled, sort_order)
values
  ('crypto_bep20', '{"ru":"USDT / USDC (BEP20)","tj":"USDT / USDC (BEP20)","en":"USDT / USDC (BEP20)"}'::jsonb, 'BEP20', 10, 100000, false, 5),
  ('crypto_sol',   '{"ru":"USDC (Solana)","tj":"USDC (Solana)","en":"USDC (Solana)"}'::jsonb,                  'SOL',   10, 100000, false, 6)
on conflict (code) do nothing;
