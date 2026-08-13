-- Store detected cross-paper contradictions on assistant messages.

alter table public.messages
  add column if not exists contradictions jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
