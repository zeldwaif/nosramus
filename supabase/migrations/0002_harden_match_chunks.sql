-- Bind vector search to the authenticated user instead of trusting client input.

drop function if exists public.match_chunks(vector, uuid, int, uuid[], float);

create or replace function public.match_chunks(
  query_embedding vector(1024),
  match_count     int default 12,
  filter_paper_ids uuid[] default null,
  min_similarity  double precision default 0.0
)
returns table (
  id         uuid,
  paper_id   uuid,
  idx        int,
  content    text,
  page       int,
  section    text,
  similarity double precision
)
language sql stable
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
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.user_id = auth.uid()
    and auth.uid() is not null
    and c.embedding is not null
    and (filter_paper_ids is null
         or array_length(filter_paper_ids, 1) is null
         or c.paper_id = any(filter_paper_ids))
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_chunks(vector, int, uuid[], double precision) from public;
grant execute on function public.match_chunks(vector, int, uuid[], double precision)
  to authenticated, service_role;

notify pgrst, 'reload schema';
