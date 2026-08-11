-- Nosramus initial schema
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

create extension if not exists vector;

-- ---------------------------------------------------------------- papers
create table if not exists public.papers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  authors       text[] not null default '{}',
  abstract      text,
  year          int,
  venue         text,
  doi           text,
  url           text,
  source        text not null default 'upload',      -- upload | arxiv | semantic_scholar
  source_id     text,                                -- arXiv id / S2 paperId
  storage_path  text,                                -- path in the `papers` storage bucket
  status        text not null default 'pending',     -- pending | processing | ready | failed
  error         text,
  page_count    int,
  created_at    timestamptz not null default now()
);

create index if not exists papers_user_idx on public.papers (user_id, created_at desc);
create unique index if not exists papers_user_source_uniq
  on public.papers (user_id, source, source_id) where source_id is not null;

-- ---------------------------------------------------------------- chunks
create table if not exists public.chunks (
  id          uuid primary key default gen_random_uuid(),
  paper_id    uuid not null references public.papers(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  idx         int  not null,
  content     text not null,
  page        int,
  section     text,
  token_count int,
  embedding   vector(1024),
  created_at  timestamptz not null default now()
);

create index if not exists chunks_paper_idx on public.chunks (paper_id, idx);
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);

-- --------------------------------------------------------- conversations
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'New conversation',
  paper_ids  uuid[] not null default '{}',   -- empty = search across whole library
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_idx
  on public.conversations (user_id, updated_at desc);

-- -------------------------------------------------------------- messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  citations       jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ------------------------------------------------------------------- RLS
alter table public.papers        enable row level security;
alter table public.chunks        enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "own papers" on public.papers;
create policy "own papers" on public.papers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own chunks" on public.chunks;
create policy "own chunks" on public.chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------- retrieval RPC
-- Cosine similarity search, scoped to the caller and optionally to papers.
create or replace function public.match_chunks(
  query_embedding vector(1024),
  match_user_id   uuid,
  match_count     int default 12,
  filter_paper_ids uuid[] default null,
  min_similarity  float default 0.0
)
returns table (
  id         uuid,
  paper_id   uuid,
  idx        int,
  content    text,
  page       int,
  section    text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.paper_id,
    c.idx,
    c.content,
    c.page,
    c.section,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.user_id = match_user_id
    and c.embedding is not null
    and (filter_paper_ids is null
         or array_length(filter_paper_ids, 1) is null
         or c.paper_id = any(filter_paper_ids))
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- --------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('papers', 'papers', false)
on conflict (id) do nothing;

drop policy if exists "own paper files" on storage.objects;
create policy "own paper files" on storage.objects
  for all
  using  (bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1]);
