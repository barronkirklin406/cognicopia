-- =====================================================================
-- Cognicopia platform. Migration 3 of 3: tenancy, row level security, grants.
--
-- WHO MAY DO WHAT (signed-in users, through the Data API)
--
--   table               read                          write
--   ------------------  ----------------------------  ---------------------------------
--   facilities          own facility                  admin: facility_name only
--   facility_users      own facility's team           admin: change role, remove member
--   content_items       any facility member           nobody (service role only)
--   activity_calendars  own facility's calendars      own facility: insert, update, delete
--
--   Nobody signed out (anon) can reach any table.
--   The service role (server only) bypasses row level security: it writes
--   billing columns, loads content, invites members and offboards facilities.
--
-- Two layers do the work. Row level security decides WHICH ROWS. Column
-- privileges decide WHICH COLUMNS, because a policy cannot: without them any
-- admin could set their own facility to 'active' by updating subscription_status.
--
-- The only way to create a facility or a team member through the Data API is
-- create_facility() below, which can only make the caller the admin of a new
-- facility. Inviting staff is done by the server with the service role.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helpers that find the caller's facility
-- ---------------------------------------------------------------------
-- A policy on facility_users cannot select from facility_users to find the
-- caller's facility: that recurses. These functions read the table as its
-- owner (security definer), bypassing row level security, and return only the
-- caller's own facility and role. They are stable, so a policy that wraps the
-- call in (select ...) evaluates it once per statement, not once per row.

create or replace function private.current_facility_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fu.facility_id from public.facility_users fu where fu.id = auth.uid()
$$;

create or replace function private.current_facility_role()
returns public.facility_role
language sql
stable
security definer
set search_path = ''
as $$
  select fu.role from public.facility_users fu where fu.id = auth.uid()
$$;

revoke all on function private.current_facility_id()   from public, anon;
revoke all on function private.current_facility_role() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.current_facility_id()   to authenticated;
grant execute on function private.current_facility_role() to authenticated;

-- ---------------------------------------------------------------------
-- 2. facilities
-- ---------------------------------------------------------------------

create policy facilities_select_own
  on public.facilities for select to authenticated
  using (id = (select private.current_facility_id()));

create policy facilities_update_admin
  on public.facilities for update to authenticated
  using (
    id = (select private.current_facility_id())
    and (select private.current_facility_role()) = 'admin'
  )
  with check (
    id = (select private.current_facility_id())
    and (select private.current_facility_role()) = 'admin'
  );

grant select on public.facilities to authenticated;
-- Only the name. subscription_status and stripe_customer_id are billing facts
-- the server writes; no tenant may change them. No insert and no delete.
grant update (facility_name) on public.facilities to authenticated;

-- ---------------------------------------------------------------------
-- 3. facility_users
-- ---------------------------------------------------------------------

create policy facility_users_select_same_facility
  on public.facility_users for select to authenticated
  using (facility_id = (select private.current_facility_id()));

create policy facility_users_update_admin
  on public.facility_users for update to authenticated
  using (
    facility_id = (select private.current_facility_id())
    and (select private.current_facility_role()) = 'admin'
  )
  with check (facility_id = (select private.current_facility_id()));

create policy facility_users_delete_admin
  on public.facility_users for delete to authenticated
  using (
    facility_id = (select private.current_facility_id())
    and (select private.current_facility_role()) = 'admin'
  );

grant select on public.facility_users to authenticated;
-- Only the role. A member cannot be moved to another facility or given another
-- email. No insert: members are added by the server (an invitation) or by
-- create_facility().
grant update (role) on public.facility_users to authenticated;
grant delete on public.facility_users to authenticated;

-- A facility must always keep an admin, or nobody can manage its team.
create or replace function private.keep_facility_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only an admin leaving the admin role (demoted, removed or moved) can break the rule.
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.facility_id <> old.facility_id)
  then
    -- Lock the facility row first, so two admins demoting each other at the same
    -- moment take turns; the second then sees the first one's committed change.
    perform 1 from public.facilities f where f.id = old.facility_id for update;
    -- Not found means the facility itself is being deleted (this row is going
    -- with it), so there is nothing left to protect.
    if found and not exists (
      select 1 from public.facility_users u
      where u.facility_id = old.facility_id and u.role = 'admin' and u.id <> old.id
    ) then
      raise exception 'A facility must keep at least one admin.'
        using errcode = 'CG001',
              hint = 'Make another member an admin before removing or demoting this one.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.keep_facility_admin() from public, anon, authenticated;

create trigger facility_users_keep_an_admin
  before update of role, facility_id or delete on public.facility_users
  for each row execute function private.keep_facility_admin();

-- facility_users.email is a copy of the sign-in email. Keep it in step when
-- the person changes their address.
create or replace function private.sync_facility_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.facility_users
       set email = lower(btrim(new.email))
     where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_facility_user_email() from public, anon, authenticated;

create trigger sync_facility_user_email
  after update of email on auth.users
  for each row execute function private.sync_facility_user_email();

-- ---------------------------------------------------------------------
-- 4. content_items: readable by facility members, writable by nobody here
-- ---------------------------------------------------------------------
-- The library is the product. A person who is signed in but belongs to no
-- facility (for example, mid sign-up) does not see it. Gating on subscription
-- status is a business decision and is deliberately not made here.

create policy content_items_select_facility_members
  on public.content_items for select to authenticated
  using ((select private.current_facility_id()) is not null);

grant select on public.content_items to authenticated;

-- ---------------------------------------------------------------------
-- 5. activity_calendars: a facility's own, for every member
-- ---------------------------------------------------------------------
-- Staff and admins may both read and write their facility's calendars. The
-- with check clauses pin facility_id, so a row can never be written into, or
-- moved to, another facility. Table-level privileges are used (not column-level)
-- so that an upsert, which sets every column it is given, works.

create policy activity_calendars_select_own_facility
  on public.activity_calendars for select to authenticated
  using (facility_id = (select private.current_facility_id()));

create policy activity_calendars_insert_own_facility
  on public.activity_calendars for insert to authenticated
  with check (facility_id = (select private.current_facility_id()));

create policy activity_calendars_update_own_facility
  on public.activity_calendars for update to authenticated
  using (facility_id = (select private.current_facility_id()))
  with check (facility_id = (select private.current_facility_id()));

create policy activity_calendars_delete_own_facility
  on public.activity_calendars for delete to authenticated
  using (facility_id = (select private.current_facility_id()));

grant select, insert, update, delete on public.activity_calendars to authenticated;

-- ---------------------------------------------------------------------
-- 6. create_facility(): the one way in
-- ---------------------------------------------------------------------
-- Creates a facility and makes the caller its first admin, in one transaction.
-- It is security definer (it must insert rows the caller has no right to insert
-- directly), so it checks everything itself. Supabase's database linter flags a
-- security definer function that signed-in users can call; that is intended here.
--
-- Errors, by SQLSTATE: 28000 not signed in; CG003 no confirmed email address;
-- 22023 invalid facility name; CG002 the account already belongs to a facility.

create or replace function public.create_facility(p_facility_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_email       text;
  v_confirmed   timestamptz;
  v_name        text := btrim(coalesce(p_facility_name, ''));
  v_facility_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to create a facility.' using errcode = '28000';
  end if;

  -- Read the email from the auth record, not from the token. An anonymous
  -- sign-in has none, and an unconfirmed address has not been proved yours.
  select lower(btrim(u.email)), u.email_confirmed_at
    into v_email, v_confirmed
    from auth.users u
   where u.id = v_user_id;

  if v_email is null or v_email = '' or v_confirmed is null then
    raise exception 'Confirm your email address before creating a facility.' using errcode = 'CG003';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'A facility name must be 1 to 120 characters.' using errcode = '22023';
  end if;

  if exists (select 1 from public.facility_users fu where fu.id = v_user_id) then
    raise exception 'This account already belongs to a facility.' using errcode = 'CG002';
  end if;

  insert into public.facilities (facility_name) values (v_name)
    returning id into v_facility_id;

  insert into public.facility_users (id, facility_id, email, role)
    values (v_user_id, v_facility_id, v_email, 'admin');

  return v_facility_id;
end;
$$;

comment on function public.create_facility(text) is
  'Creates a facility and makes the signed-in caller its admin. Callable by signed-in users only.';

revoke all on function public.create_facility(text) from public, anon;
grant execute on function public.create_facility(text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. The server
-- ---------------------------------------------------------------------
-- The service role bypasses row level security, but still needs privileges.
-- It writes billing columns, loads content and manages membership.

grant all on public.facilities, public.facility_users, public.content_items, public.activity_calendars
  to service_role;
