-- ---------------------------------------------------------------------------
-- user_settings.top_sectors — per-user list of top trending sectors that get
-- rendered as a small reminder strip below the navbar across the app.
-- ---------------------------------------------------------------------------

alter table public.user_settings
  add column if not exists top_sectors text[] not null default '{}'::text[];
