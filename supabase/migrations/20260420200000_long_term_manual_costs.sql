-- Optional overrides for watchlist row; when null, UI falls back to portfolio aggregates.
alter table public.long_term_holdings
  add column if not exists manual_avg_cost_bdt numeric,
  add column if not exists manual_total_invested_bdt numeric;
