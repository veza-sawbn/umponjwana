-- ============================================================================
-- Supabase shim for local migration tests.
--
-- The migrations in supabase/migrations/ are written against a Supabase
-- project: they assume an `auth` schema, the auth.uid()/auth.role() helpers,
-- the anon/authenticated/service_role database roles, and a `storage` schema.
-- A bare Postgres has none of those, so this file creates just enough of them
-- for the migrations to load and for the security tests in this directory to
-- exercise the real function bodies rather than a paraphrase of them.
--
-- It is a TEST FIXTURE. It is never run against a real project — Supabase
-- provides all of this itself.
--
-- auth.uid()/auth.role() read from session GUCs so a test can say
--   select set_config('test.uid', '<uuid>', true);
-- to act as a given user, which is what supabase/tests/helpers.sql wraps.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Roles ───────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- ── auth schema ─────────────────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id              uuid primary key default gen_random_uuid(),
  email           text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  raw_app_meta_data   jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- The tests set these GUCs to choose who is calling. An unset GUC means "no
-- JWT at all", which is exactly the case 20260903_null_safe_admin_guards.sql
-- was written about, so it must come back NULL rather than ''.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('test.role', true), '')
$$;

create or replace function auth.email() returns text language sql stable as $$
  select email from auth.users where id = auth.uid()
$$;

-- ── storage schema (policies reference it; no behaviour needed) ─────────────
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text not null,
  owner     uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
