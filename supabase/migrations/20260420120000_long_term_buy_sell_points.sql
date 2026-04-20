-- Optional price levels per watchlist row (BDT).
alter table public.long_term_holdings
  add column if not exists buy_point_bdt numeric,
  add column if not exists sell_point_bdt numeric;
