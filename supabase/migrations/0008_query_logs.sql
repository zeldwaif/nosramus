-- Per-query observability: latency, tokens, estimated cost.

create table if not exists public.query_logs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  conversation_id       uuid references public.conversations(id) on delete set null,
  message_id            uuid references public.messages(id) on delete set null,
  retrieval_ms          int,
  generation_ms         int,
  input_tokens          int,
  output_tokens         int,
  estimated_cost_usd    numeric,
  retrieved_chunk_count int,
  created_at            timestamptz not null default now()
);

create index if not exists query_logs_user_idx
  on public.query_logs (user_id, created_at desc);

alter table public.query_logs enable row level security;

drop policy if exists "own query logs" on public.query_logs;
create policy "own query logs" on public.query_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
