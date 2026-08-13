-- Hybrid retrieval: full-text search column + keyword RPC (vector search unchanged).

alter table public.chunks
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', content)) stored;

create index if not exists chunks_content_tsv_idx
  on public.chunks using gin (content_tsv);

create or replace function public.match_chunks_fts(
  query_text       text,
  match_count      int default 30,
  filter_paper_ids uuid[] default null
)
returns table (
  id         uuid,
  paper_id   uuid,
  idx        int,
  content    text,
  page       int,
  section    text,
  rank       double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.paper_id,
    c.idx,
    c.content,
    c.page,
    c.section,
    ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', query_text)) as rank
  from public.chunks c
  where c.user_id = auth.uid()
    and auth.uid() is not null
    and c.content_tsv @@ websearch_to_tsquery('english', query_text)
    and (filter_paper_ids is null
         or array_length(filter_paper_ids, 1) is null
         or c.paper_id = any(filter_paper_ids))
  order by rank desc
  limit match_count;
$$;

grant execute on function public.match_chunks_fts(text, int, uuid[])
  to authenticated, service_role;

notify pgrst, 'reload schema';
