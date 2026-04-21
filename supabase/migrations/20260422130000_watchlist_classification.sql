-- Optional watchlist chip: one of BLUE, GREEN, or unset (unclassified).

alter table public.long_term_holdings
  add column if not exists classification text;

alter table public.long_term_holdings
  drop constraint if exists long_term_holdings_classification_check;

alter table public.long_term_holdings
  add constraint long_term_holdings_classification_check
  check (classification is null or classification in ('BLUE', 'GREEN'));
