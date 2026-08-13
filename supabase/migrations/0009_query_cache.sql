-- Exact-match response cache (1-hour TTL).

create table if not exists public.query_cache (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  query_hash     text not null,
  paper_ids_hash text not null,
  response       jsonb not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null
);

create index if not exists query_cache_lookup_idx
  on public.query_cache (user_id, query_hash, paper_ids_hash, expires_at);

alter table public.query_cache enable row level security;

drop policy if exists "own query cache" on public.query_cache;
create policy "own query cache" on public.query_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
