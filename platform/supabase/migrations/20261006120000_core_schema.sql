-- =====================================================================
-- Cognicopia platform. Migration 1 of 3: the core multi-tenant schema.
--
-- ZERO-PHI RULE
--   This database holds content and planning data for facility staff. It
--   never holds protected health information: no resident names, no
--   resident-level records, nothing about anyone's health. No table here is
--   keyed to a resident, and migration 2 guards the one tenant-writable
--   JSON column (activity_calendars.generated_data) against resident-level
--   keys. Staff email addresses are personal data, but they are not PHI.
--
-- TENANCY
--   A facility is a tenant. A staff account belongs to exactly one facility
--   (facility_users.id is the Supabase auth user id). Every tenant row
--   carries a facility_id. Migration 3 adds the row level security that
--   limits each signed-in user to their own facility.
--
-- SAFE BY DEFAULT
--   Row level security is switched on here, in the same migration that
--   creates each table, and every privilege is revoked from the API roles.
--   Until migration 3 grants something back, nothing is reachable.
-- =====================================================================

-- Internal functions live in "private", a schema the Data API does not expose.
create schema if not exists private;
comment on schema private is 'Internal functions. Not exposed through the Data API (PostgREST).';

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------

-- The same values as Stripe's Subscription.status, so a webhook can copy the
-- status straight across. A new facility starts in a trial.
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused'
);

create type public.facility_role as enum ('admin', 'staff');

-- 'universal' means suitable for any stage.
create type public.dementia_stage as enum ('early', 'middle', 'late', 'universal');

-- ---------------------------------------------------------------------
-- facilities: one row per customer (tenant)
-- ---------------------------------------------------------------------

create table public.facilities (
  id                  uuid primary key default gen_random_uuid(),
  facility_name       text not null,
  subscription_status public.subscription_status not null default 'trialing',
  stripe_customer_id  text,
  created_at          timestamptz not null default now(),

  constraint facilities_facility_name_length
    check (char_length(btrim(facility_name)) between 1 and 120),
  constraint facilities_stripe_customer_id_format
    check (stripe_customer_id is null
           or (left(stripe_customer_id, 4) = 'cus_' and char_length(stripe_customer_id) <= 255))
);

-- One Stripe customer belongs to one facility, or billing webhooks cross-wire.
create unique index facilities_stripe_customer_id_key
  on public.facilities (stripe_customer_id)
  where stripe_customer_id is not null;

comment on table public.facilities is
  'A customer organisation (tenant). Billing columns are written only by the server (service role), never by a facility.';
comment on column public.facilities.subscription_status is
  'Mirrors the Stripe subscription status. Written only by the Stripe webhook (service role).';
comment on column public.facilities.stripe_customer_id is
  'Stripe customer id (cus_...). Written only by the server.';

-- ---------------------------------------------------------------------
-- facility_users: staff accounts, and which facility each belongs to
-- ---------------------------------------------------------------------

create table public.facility_users (
  -- The Supabase auth user id, so auth.uid() finds the membership directly.
  id          uuid primary key references auth.users (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  -- A copy of the auth email, kept in step by a trigger (migration 3).
  email       text not null,
  role        public.facility_role not null default 'staff',
  created_at  timestamptz not null default now(),

  constraint facility_users_email_format
    check (email = lower(btrim(email))
           and char_length(email) between 3 and 254
           and email ~ '^[^@\s]+@[^@\s]+$')
);

create index facility_users_facility_id_idx on public.facility_users (facility_id);

comment on table public.facility_users is
  'Staff accounts. One account belongs to one facility. This is staff contact data, never resident data.';
comment on column public.facility_users.role is
  'admin: manages the facility and its team. staff: works with calendars and content.';

-- ---------------------------------------------------------------------
-- content_items: the shared activity library
-- ---------------------------------------------------------------------

-- Global, not per tenant: authored by Cognicopia, read by every facility.
create table public.content_items (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  -- A lowercase slug, for example 'music' or 'cognicopia-coloring'. The list of
  -- known categories lives in the application, so it can grow without a migration.
  category        text not null,
  -- No default on purpose: an author must choose the stage. A silent default of
  -- 'universal' could put an unsuitable activity in front of a late-stage group.
  dementia_stage  public.dementia_stage not null,
  content_payload jsonb not null,
  created_at      timestamptz not null default now(),

  constraint content_items_title_length
    check (char_length(btrim(title)) between 1 and 200),
  constraint content_items_category_slug
    check (category ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(category) <= 64),
  constraint content_items_payload_is_object
    check (jsonb_typeof(content_payload) = 'object')
);

create index content_items_stage_category_idx
  on public.content_items (dementia_stage, category);

comment on table public.content_items is
  'The shared activity library. Read-only for facilities; written by Cognicopia through the service role or migrations.';

-- ---------------------------------------------------------------------
-- activity_calendars: one generated month per facility
-- ---------------------------------------------------------------------

create table public.activity_calendars (
  id             uuid primary key default gen_random_uuid(),
  facility_id    uuid not null references public.facilities (id) on delete cascade,
  -- 'YYYY-MM' as text, not a date: a date parsed in the browser slips a day
  -- in time zones behind UTC. It sorts correctly as text.
  month_year     text not null,
  generated_data jsonb not null,
  created_at     timestamptz not null default now(),

  constraint activity_calendars_month_year_format
    check (month_year ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- One calendar per facility per month, so regenerating a month is an upsert.
  constraint activity_calendars_facility_month_key
    unique (facility_id, month_year),
  constraint activity_calendars_generated_data_is_object
    check (jsonb_typeof(generated_data) = 'object'),
  -- A calendar is tenant-written, so its size is bounded: 1 MiB of JSON text.
  constraint activity_calendars_generated_data_size
    check (octet_length(generated_data::text) <= 1048576)
);

comment on table public.activity_calendars is
  'A facility''s generated activity calendar for one month. Group-level planning data only: never resident names or records.';
comment on column public.activity_calendars.generated_data is
  'Versioned JSON (see lib/domain/calendar.ts). Guarded against resident-level keys; see migration 2.';

-- ---------------------------------------------------------------------
-- Locked down until migration 3 says otherwise
-- ---------------------------------------------------------------------

alter table public.facilities         enable row level security;
alter table public.facility_users     enable row level security;
alter table public.content_items      enable row level security;
alter table public.activity_calendars enable row level security;

-- Supabase grants new tables to anon and authenticated by default. Take it all
-- back; migration 3 grants only what each table needs.
revoke all on public.facilities, public.facility_users, public.content_items, public.activity_calendars
  from anon, authenticated;
