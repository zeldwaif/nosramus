-- Structured facts extracted from papers at ingestion time.

create table if not exists public.paper_facts (
  id         uuid primary key default gen_random_uuid(),
  paper_id   uuid not null references public.papers(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  fact_type  text not null check (fact_type in (
    'dataset', 'metric', 'model_size', 'architecture', 'result'
  )),
  key        text not null,
  value      text not null,
  evidence   text,
  page       int,
  created_at timestamptz not null default now()
);

create index if not exists paper_facts_paper_idx on public.paper_facts (paper_id);

alter table public.paper_facts enable row level security;

drop policy if exists "own paper facts" on public.paper_facts;
create policy "own paper facts" on public.paper_facts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
