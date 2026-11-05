-- A calendar can now be edited by hand (swap a session, pin it, change its note), so two people can
-- change the same month at once. updated_at is how the second one finds out: an edit says which
-- version it started from, and is refused if the month has changed since.
--
-- The trigger sets it on every update, from the database's own clock, so no client can set it:
-- a client sending its own updated_at is overwritten.

alter table public.activity_calendars
  add column updated_at timestamptz not null default now();

comment on column public.activity_calendars.updated_at is
  'When this month was last saved. Set by a trigger, never by the client. Used to refuse an edit made from an out-of-date copy.';

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- clock_timestamp(), not now(): two saves in one transaction still differ.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger activity_calendars_set_updated_at
  before update on public.activity_calendars
  for each row execute function private.set_updated_at();
