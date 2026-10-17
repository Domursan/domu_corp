-- =====================================================================
--  Domursan — schéma Supabase (déjà appliqué sur le projet « Gestion_RP »)
--  Tables préfixées d_ pour cohabiter avec les anciennes tables d'Airpé.
--  Prérequis : fonction public.set_updated_at() (créée avec Airpé), sinon :
--    create or replace function public.set_updated_at() returns trigger
--    language plpgsql set search_path = public as $$ begin new.updated_at := now(); return new; end $$;
-- =====================================================================

create table if not exists public.d_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.d_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, category text, status text, color text, icon text, logo_url text, description text,
  tags text[] not null default '{}', pinned boolean not null default false, position int,
  start_date date, end_date date,
  modules text[] not null default '{}',          -- onglets actifs
  tech jsonb not null default '{}'::jsonb,       -- fiche technique
  deploy jsonb not null default '{}'::jsonb,     -- checklist + historique des déploiements
  last_activity timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Tables des onglets (toutes : id, owner_id, project_id, created_at, updated_at)
create table if not exists public.d_links (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  label text, url text not null, kind text, position int, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_tasks (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  title text not null, status text, priority text, due_date date, description text, subtasks jsonb not null default '[]'::jsonb, position int, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_notes (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  title text not null, content text, pinned boolean not null default false, position int, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_changelog (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  version text, date date not null default current_date, title text not null, details text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_events (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  title text not null, starts_at timestamptz not null, ends_at timestamptz, all_day boolean not null default false, recurrence text not null default 'none', recurrence_until date, location text, notes text, color text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_files (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  name text not null, url text not null, path text, mime text, size bigint, note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_contacts (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  name text not null, company text, contact text, phone text, email text, status text, notes text, links jsonb not null default '[]'::jsonb, cap numeric(14,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_transactions (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  kind text not null check (kind in ('recette','depense')), amount numeric(14,2) not null default 0, label text not null, category text, date date not null default current_date,
  contact_id uuid references public.d_contacts(id) on delete set null, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_inventory (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  name text not null, category text, quantity numeric(14,2) not null default 0, alert_threshold numeric(14,2), unit_value numeric(14,2), location text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.d_bugs (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade, project_id uuid not null references public.d_projects(id) on delete cascade,
  title text not null, kind text not null default 'Bug', status text, priority text, version text, description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

-- Catalogue des features (global, lié à plusieurs projets)
create table if not exists public.d_features (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, icon text, color text, category text, summary text, description text, how_to text,
  tags text[] not null default '{}', project_ids uuid[] not null default '{}', links jsonb not null default '[]'::jsonb, position int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.d_owns_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from d_projects p where p.id = pid and p.owner_id = auth.uid())
$$;
revoke execute on function public.d_owns_project(uuid) from anon, public;
grant execute on function public.d_owns_project(uuid) to authenticated;

-- Met à jour « dernière activité » du projet à chaque changement dans un onglet
create or replace function public.d_touch_project()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
  update d_projects set last_activity = now() where id = pid;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.d_touch_project() from anon, authenticated, public;

alter table public.d_settings enable row level security;
alter table public.d_projects enable row level security;
alter table public.d_features enable row level security;
drop policy if exists d_settings_own on public.d_settings;
create policy d_settings_own on public.d_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists d_projects_own on public.d_projects;
create policy d_projects_own on public.d_projects for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists d_features_own on public.d_features;
create policy d_features_own on public.d_features for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create index if not exists idx_d_projects_owner on public.d_projects(owner_id);
create index if not exists idx_d_features_owner on public.d_features(owner_id);
create index if not exists idx_d_tx_contact on public.d_transactions(contact_id);

do $$
declare t text;
begin
  foreach t in array array['d_links','d_tasks','d_notes','d_changelog','d_events','d_files','d_contacts','d_transactions','d_inventory','d_bugs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and public.d_owns_project(project_id))', t || '_own', t);
    execute format('create index if not exists %I on public.%I(project_id)', 'idx_' || t || '_project', t);
    execute format('create index if not exists %I on public.%I(owner_id)', 'idx_' || t || '_owner', t);
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch after insert or update or delete on public.%I for each row execute function public.d_touch_project()', t);
  end loop;
  foreach t in array array['d_settings','d_projects','d_features','d_links','d_tasks','d_notes','d_changelog','d_events','d_files','d_contacts','d_transactions','d_inventory','d_bugs'] loop
    execute format('drop trigger if exists trg_updated_at on public.%I', t);
    execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Stockage : logos/images dans « photos » (bucket d'Airpé), fichiers dans « d-files »
insert into storage.buckets (id, name, public, file_size_limit) values ('d-files', 'd-files', true, 26214400) on conflict (id) do nothing;
drop policy if exists dfiles_insert_own on storage.objects;
create policy dfiles_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'd-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists dfiles_update_own on storage.objects;
create policy dfiles_update_own on storage.objects for update to authenticated using (bucket_id = 'd-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists dfiles_delete_own on storage.objects;
create policy dfiles_delete_own on storage.objects for delete to authenticated using (bucket_id = 'd-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
