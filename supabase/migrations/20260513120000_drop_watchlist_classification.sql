-- Drop the watchlist classification (Blue/Green chip) feature.

alter table public.long_term_holdings
  drop constraint if exists long_term_holdings_classification_check;

alter table public.long_term_holdings
  drop column if exists classification;
