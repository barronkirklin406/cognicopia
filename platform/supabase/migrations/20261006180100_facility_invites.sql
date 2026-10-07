-- =====================================================================
-- Cognicopia platform. Migration 5: invitations to join a facility.
--
-- HOW STAFF JOIN
--   An admin creates an invitation and shares the link they are given. The
--   person opens the link, signs in (or creates their own account) and accepts.
--   They become a member of that facility, as staff or as an admin, whichever
--   the invitation says. Everyone has their own sign-in: there is no shared
--   facility password. A facility that wants one login for a shared computer
--   can invite a shared mailbox it controls, and that mailbox then holds an
--   ordinary account.
--
-- WHAT IS STORED
--   Never the secret in the link, only its SHA-256. The secret is made here,
--   handed back once to the admin who asked, and cannot be looked up again. An
--   invitation can name an email address; then only the account with that
--   confirmed address can accept it. It lasts 7 days, works once, and an admin
--   can cancel it any time before it is used.
--
--   An invitation holds a staff email address: personal data, not PHI.
--
-- WHO MAY DO WHAT
--   facility_invites    read: admins of that facility (never the hash)
--                       delete: admins, while it is still unused (cancel)
--   create_facility_invite()   admins only
--   preview_facility_invite()  anyone signed in who holds the secret
--   accept_facility_invite()   anyone signed in with a confirmed email and no
--                              facility who holds the secret
--   Errors, by SQLSTATE: 28000 not signed in; 42501 not an admin; 22023 bad
--   email; 54000 too many open invitations; CG002 already a member; CG003 no
--   confirmed email; CG004 the invitation is not valid (unknown, used or
--   expired); CG005 it was sent to a different address.
-- =====================================================================

create table public.facility_invites (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  -- SHA-256, in hex, of the secret in the link. The secret itself is never stored.
  token_hash  text not null,
  -- When set, only the account with this (confirmed) address can accept.
  email       text,
  role        public.facility_role not null default 'staff',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,

  constraint facility_invites_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint facility_invites_email_format
    check (email is null
           or (email = lower(btrim(email))
               and char_length(email) between 3 and 254
               and email ~ '^[^@\s]+@[^@\s]+$')),
  constraint facility_invites_expiry_after_creation
    check (expires_at > created_at)
);

create unique index facility_invites_token_hash_key on public.facility_invites (token_hash);
create index facility_invites_facility_id_idx on public.facility_invites (facility_id);

comment on table public.facility_invites is
  'Invitations to join a facility. Holds only a hash of the secret in the link. Staff contact data, never resident data.';
comment on column public.facility_invites.token_hash is
  'SHA-256 (hex) of the secret in the invitation link. The secret is not stored.';
comment on column public.facility_invites.email is
  'When set, only the account with this confirmed address can accept the invitation.';

-- Safe by default, as in migration 1.
alter table public.facility_invites enable row level security;
revoke all on public.facility_invites from anon, authenticated;

-- ---------------------------------------------------------------------
-- Admins see and cancel their own facility's invitations
-- ---------------------------------------------------------------------

create policy facility_invites_select_admin
  on public.facility_invites for select to authenticated
  using (
    facility_id = (select private.current_facility_id())
    and (select private.current_facility_role()) = 'admin'
  );

create policy facility_invites_delete_admin
  on public.facility_invites for delete to authenticated
  using (
    facility_id = (select private.current_facility_id())
    and (select private.current_facility_role()) = 'admin'
    and accepted_at is null
  );

-- Every column except the hash: nobody needs it, so nobody gets it.
grant select (id, facility_id, email, role, created_by, created_at, expires_at, accepted_at, accepted_by)
  on public.facility_invites to authenticated;
grant delete on public.facility_invites to authenticated;
grant all on public.facility_invites to service_role;

-- ---------------------------------------------------------------------
-- create_facility_invite(): admins only; returns the secret, once
-- ---------------------------------------------------------------------
-- Security definer: nobody may insert into the table directly, so the function
-- checks everything itself. A new invitation for an email replaces any open one
-- for the same email, so "send again" is just "create again".

create or replace function public.create_facility_invite(
  p_email text default null,
  p_role  public.facility_role default 'staff'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_facility uuid;
  v_role     public.facility_role;
  v_email    text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_token    text;
begin
  if v_user is null then
    raise exception 'Sign in to invite people.' using errcode = '28000';
  end if;

  select fu.facility_id, fu.role into v_facility, v_role
    from public.facility_users fu
   where fu.id = v_user;

  if v_facility is null or v_role <> 'admin' then
    raise exception 'Only a facility admin can invite people.' using errcode = '42501';
  end if;

  if v_email is not null
     and (char_length(v_email) not between 3 and 254 or v_email !~ '^[^@\s]+@[^@\s]+$') then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  -- Take turns with any other invitation being made for this facility, so the
  -- limit below holds.
  perform 1 from public.facilities f where f.id = v_facility for update;

  if v_email is not null then
    if exists (select 1 from public.facility_users fu where fu.facility_id = v_facility and fu.email = v_email) then
      raise exception 'That person is already on your team.' using errcode = 'CG002';
    end if;
    delete from public.facility_invites i
     where i.facility_id = v_facility and i.email = v_email and i.accepted_at is null;
  end if;

  if (select count(*) from public.facility_invites i
       where i.facility_id = v_facility and i.accepted_at is null and i.expires_at > now()) >= 50 then
    raise exception 'There are too many open invitations. Cancel some first.' using errcode = '54000';
  end if;

  -- Two random UUIDs: 244 bits from the server's strong random source.
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.facility_invites (facility_id, token_hash, email, role, created_by, expires_at)
  values (
    v_facility,
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    v_email,
    coalesce(p_role, 'staff'),
    v_user,
    now() + interval '7 days'
  );

  return v_token;
end;
$$;

comment on function public.create_facility_invite(text, public.facility_role) is
  'Admins only. Creates a 7-day, single-use invitation to the caller''s facility and returns its secret, once. Only a hash is kept.';

revoke all on function public.create_facility_invite(text, public.facility_role) from public, anon;
grant execute on function public.create_facility_invite(text, public.facility_role) to authenticated;

-- ---------------------------------------------------------------------
-- preview_facility_invite(): what the link is for, before accepting
-- ---------------------------------------------------------------------
-- No rows when the secret is unknown, used or expired. Holding the secret is
-- what entitles someone to see the facility's name.

create or replace function public.preview_facility_invite(p_token text)
returns table (facility_name text, role public.facility_role, email_locked boolean, email_matches boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select f.facility_name,
         i.role,
         i.email is not null,
         i.email is null
           or coalesce(i.email = (select lower(btrim(u.email)) from auth.users u where u.id = auth.uid()), false)
    from public.facility_invites i
    join public.facilities f on f.id = i.facility_id
   where auth.uid() is not null
     and i.token_hash = encode(sha256(convert_to(btrim(coalesce(p_token, ''), E' \t\r\n'), 'UTF8')), 'hex')
     and i.accepted_at is null
     and i.expires_at > now()
$$;

comment on function public.preview_facility_invite(text) is
  'For a signed-in holder of an invitation secret: the facility''s name, the role offered, and whether the invitation is tied to an email address that is theirs.';

revoke all on function public.preview_facility_invite(text) from public, anon;
grant execute on function public.preview_facility_invite(text) to authenticated;

-- ---------------------------------------------------------------------
-- accept_facility_invite(): join the facility
-- ---------------------------------------------------------------------
-- The invitation row is locked while it is used, so two people opening one link
-- at the same moment cannot both get in. Returns the facility's id.

create or replace function public.accept_facility_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_invite    public.facility_invites%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in to accept an invitation.' using errcode = '28000';
  end if;

  -- The address comes from the auth record, not the token, and must be confirmed.
  select lower(btrim(u.email)), u.email_confirmed_at into v_email, v_confirmed
    from auth.users u
   where u.id = v_user;

  if v_email is null or v_email = '' or v_confirmed is null then
    raise exception 'Confirm your email address first.' using errcode = 'CG003';
  end if;

  select * into v_invite
    from public.facility_invites i
   where i.token_hash = encode(sha256(convert_to(btrim(coalesce(p_token, ''), E' \t\r\n'), 'UTF8')), 'hex')
     for update;

  if not found or v_invite.accepted_at is not null or v_invite.expires_at <= now() then
    raise exception 'This invitation is no longer valid.' using errcode = 'CG004';
  end if;

  if v_invite.email is not null and v_invite.email <> v_email then
    raise exception 'This invitation was sent to a different email address.' using errcode = 'CG005';
  end if;

  if exists (select 1 from public.facility_users fu where fu.id = v_user) then
    raise exception 'This account already belongs to a facility.' using errcode = 'CG002';
  end if;

  insert into public.facility_users (id, facility_id, email, role)
  values (v_user, v_invite.facility_id, v_email, v_invite.role);

  update public.facility_invites
     set accepted_at = now(), accepted_by = v_user
   where id = v_invite.id;

  return v_invite.facility_id;
end;
$$;

comment on function public.accept_facility_invite(text) is
  'Signed-in holder of an invitation secret, with a confirmed email and no facility: joins the facility in the role offered. Returns the facility id.';

revoke all on function public.accept_facility_invite(text) from public, anon;
grant execute on function public.accept_facility_invite(text) to authenticated;
