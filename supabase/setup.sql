-- =====================================================================
-- NEXUS CONNECTION - setup Supabase
-- Esegui TUTTO questo file una sola volta in: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1) Tabella unica dei documenti (players, npcs, items, quests, party, msgs, accounts...)
create table if not exists public.docs (
  collection text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_collection_idx on public.docs (collection);

-- 2) Aggiornamento "merge" atomico (equivale a update() dell'app)
create or replace function public.doc_merge(p_col text, p_id text, p_patch jsonb)
returns void language sql as $$
  insert into public.docs (collection, id, data)
  values (p_col, p_id, p_patch)
  on conflict (collection, id)
  do update set data = public.docs.data || excluded.data, updated_at = now();
$$;

-- 3) Sicurezza a livello di riga
--    ATTENZIONE: questa policy e' APERTA (prototipo). Leggi la sezione Sicurezza del README.
alter table public.docs enable row level security;
drop policy if exists nx_open_access on public.docs;
create policy nx_open_access on public.docs
  for all to anon, authenticated using (true) with check (true);

-- 4) Aggiornamenti in tempo reale
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 5) Archivio foto (NPC e oggetti): bucket pubblico "media", max 2 MB, solo immagini
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists nx_media_read   on storage.objects;
drop policy if exists nx_media_upload on storage.objects;
create policy nx_media_read   on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy nx_media_upload on storage.objects for insert to anon, authenticated with check (bucket_id = 'media');
