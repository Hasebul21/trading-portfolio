-- Personal knowledge notes: user-authored entries searchable alongside static content.

create table if not exists public.knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  title text not null,
  body text not null
);

create index if not exists knowledge_notes_user_created_idx
  on public.knowledge_notes (user_id, created_at desc);

alter table public.knowledge_notes enable row level security;

drop policy if exists "knowledge_notes_select_own" on public.knowledge_notes;
create policy "knowledge_notes_select_own"
  on public.knowledge_notes for select
  using (auth.uid() = user_id);

drop policy if exists "knowledge_notes_insert_own" on public.knowledge_notes;
create policy "knowledge_notes_insert_own"
  on public.knowledge_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "knowledge_notes_delete_own" on public.knowledge_notes;
create policy "knowledge_notes_delete_own"
  on public.knowledge_notes for delete
  using (auth.uid() = user_id);
