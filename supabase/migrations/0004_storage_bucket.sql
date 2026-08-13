-- Create the papers storage bucket and RLS policy (if not already present).
-- Run in Supabase → SQL Editor.

insert into storage.buckets (id, name, public)
values ('papers', 'papers', false)
on conflict (id) do nothing;

drop policy if exists "own paper files" on storage.objects;
create policy "own paper files" on storage.objects
  for all
  using  (bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1]);
