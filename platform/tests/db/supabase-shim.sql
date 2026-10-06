-- =====================================================================
-- Test shim: the parts of a Supabase project that our migrations rely on.
--
-- The tests run the real migrations in an in-process Postgres (PGlite), which
-- is plain Postgres with no Supabase around it. This file stands in for what
-- Supabase provides:
--   - the roles anon, authenticated and service_role
--   - Supabase's default privileges: new tables, functions and sequences in
--     "public" are granted to all three roles. The migrations revoke what they
--     do not want, so the tests must start from the same broad default.
--   - the auth schema: auth.users, and auth.uid() / auth.jwt() / auth.role(),
--     which read the request's JWT claims from settings, as PostgREST sets them.
-- It is not used in production. Supabase supplies the real thing.
-- =====================================================================

create role anon          nologin noinherit;
create role authenticated nologin noinherit;
create role service_role  nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Only the columns the platform reads or relies on. The real table has more.
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  email_confirmed_at timestamptz,
  is_anonymous       boolean not null default false,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
