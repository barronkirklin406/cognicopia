-- =====================================================================
-- Cognicopia platform. Migration 4: billing columns and the subscription gate.
--
-- WHAT THIS ADDS
--   1. A new facility starts with no subscription ('incomplete'), not in a
--      free trial. Stripe is the system of record for billing: a trial, if you
--      want one, is a Stripe trial on the subscription (STRIPE_TRIAL_DAYS), so
--      it ends when Stripe says it does.
--   2. The facts the Stripe webhook records on a facility: its subscription,
--      the plan's interval, when the current period ends, and whether it is set
--      to end then. Only the server writes them (see migration 3: tenants may
--      change a facility's name and nothing else).
--   3. The gate. The activity library, and writing calendars, now need a
--      subscription that grants access: 'trialing' or 'active'. A facility
--      whose subscription is past due, unpaid, canceled, paused or never
--      started can still sign in, see and manage its team and its settings,
--      reach billing, and read its own saved calendars. It cannot read the
--      library or change a calendar until it is paid up again.
--   4. apply_stripe_subscription(): the one function the server uses to record
--      what Stripe says. It cannot go backwards: an older observation never
--      replaces a newer one.
--
-- WHY THE GATE IS IN THE DATABASE AS WELL AS IN THE APP
--   The app also checks (lib/access), so a lapsed facility gets a clear renewal
--   prompt instead of an error. But the Data API is open to anyone holding a
--   signed-in token, so a check that lived only in the app could be walked
--   around. The library is the product; it is guarded where it is stored.
--
-- KEEPING THE LIST IN STEP
--   Which statuses grant access is decided in two places: here, and in
--   lib/domain/subscription.ts. A test runs both over every status and fails
--   if they disagree.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A new facility has not subscribed yet
-- ---------------------------------------------------------------------
-- 'incomplete' is Stripe's word for a subscription whose first payment has not
-- succeeded. Here it also covers "no subscription yet": both mean no access.

alter table public.facilities
  alter column subscription_status set default 'incomplete';

-- ---------------------------------------------------------------------
-- 2. What the webhook records
-- ---------------------------------------------------------------------

alter table public.facilities
  add column stripe_subscription_id           text,
  -- 'month' or 'year', from the price. Null for anything else.
  add column subscription_interval            text,
  -- End of the current billing period (or of the trial, while trialing).
  add column subscription_current_period_end  timestamptz,
  -- True when the customer has asked to end at the close of the period. Access
  -- continues until then: the status stays 'active' until Stripe ends it.
  add column subscription_cancel_at_period_end boolean not null default false,
  -- When the server last looked at Stripe for this facility. See
  -- apply_stripe_subscription(): an older observation is never applied.
  add column subscription_synced_at           timestamptz,

  add constraint facilities_stripe_subscription_id_format
    check (stripe_subscription_id is null
           or (left(stripe_subscription_id, 4) = 'sub_' and char_length(stripe_subscription_id) <= 255)),
  add constraint facilities_subscription_interval_values
    check (subscription_interval is null or subscription_interval in ('month', 'year'));

create unique index facilities_stripe_subscription_id_key
  on public.facilities (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.facilities.stripe_subscription_id is
  'The Stripe subscription that decides this facility''s status. Written only by the server.';
comment on column public.facilities.subscription_interval is
  'Billing interval of the plan: month or year. Written only by the server.';
comment on column public.facilities.subscription_current_period_end is
  'End of the current billing period, or of the trial. Written only by the server.';
comment on column public.facilities.subscription_cancel_at_period_end is
  'True when the subscription is set to end at the close of the current period. Written only by the server.';
comment on column public.facilities.subscription_synced_at is
  'When the server last observed this facility''s subscription at Stripe. Written only by the server.';

-- ---------------------------------------------------------------------
-- 3. Which statuses grant access
-- ---------------------------------------------------------------------
-- past_due is NOT among them: a payment has failed, and the renewal prompt
-- sends the facility's admin to the Stripe billing portal to fix it. Stripe
-- keeps retrying the card for a while; if you would rather give a grace period,
-- change the list here and in lib/domain/subscription.ts together.

create or replace function private.subscription_grants_access(p_status public.subscription_status)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_status in ('trialing', 'active')
$$;

revoke all on function private.subscription_grants_access(public.subscription_status) from public, anon;

-- Does the caller's own facility have a subscription that grants access?
-- False for someone with no facility. Like the helpers in migration 3 it reads
-- as its owner, so a policy can call it; policies wrap the call in (select ...)
-- so it runs once per statement, not once per row.

create or replace function private.current_facility_has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.subscription_grants_access(f.subscription_status)
       from public.facility_users fu
       join public.facilities f on f.id = fu.facility_id
      where fu.id = auth.uid()),
    false)
$$;

revoke all on function private.current_facility_has_access() from public, anon;
grant execute on function private.current_facility_has_access() to authenticated;

-- ---------------------------------------------------------------------
-- 4. The gate
-- ---------------------------------------------------------------------

-- The library: members of a facility whose subscription grants access.
drop policy content_items_select_facility_members on public.content_items;

create policy content_items_select_subscribed_members
  on public.content_items for select to authenticated
  using ((select private.current_facility_has_access()));

-- Calendars: reading stays open to the facility's own members (it is their
-- data), writing needs a subscription. The with check on update means a lapsed
-- facility cannot change a row it can still see; delete is simply filtered out.
drop policy activity_calendars_insert_own_facility on public.activity_calendars;
drop policy activity_calendars_update_own_facility on public.activity_calendars;
drop policy activity_calendars_delete_own_facility on public.activity_calendars;

create policy activity_calendars_insert_subscribed_facility
  on public.activity_calendars for insert to authenticated
  with check (
    facility_id = (select private.current_facility_id())
    and (select private.current_facility_has_access())
  );

create policy activity_calendars_update_subscribed_facility
  on public.activity_calendars for update to authenticated
  using (facility_id = (select private.current_facility_id()))
  with check (
    facility_id = (select private.current_facility_id())
    and (select private.current_facility_has_access())
  );

create policy activity_calendars_delete_subscribed_facility
  on public.activity_calendars for delete to authenticated
  using (
    facility_id = (select private.current_facility_id())
    and (select private.current_facility_has_access())
  );

-- ---------------------------------------------------------------------
-- 5. Recording what Stripe says
-- ---------------------------------------------------------------------
-- The server (the Stripe webhook, and the "check my payment" button) looks at
-- Stripe, picks the facility's current subscription, and calls this with what
-- it saw. Everything arrives as one snapshot, so the function has little to
-- decide:
--   - the facility is found by its Stripe customer id; none found means the
--     customer is not ours: 'unlinked';
--   - an observation older than the one already recorded is dropped: 'stale'.
--     Stripe delivers events more than once and out of order, and two requests
--     can overlap. Each caller notes the time BEFORE it asks Stripe, so a late
--     answer to an early question can never overwrite a newer one;
--   - otherwise the facility's billing columns are replaced: 'applied'.
-- It locks the facility's row, so two calls for one facility take turns.
--
-- It is not security definer. Only the service role may run it, and the service
-- role can already write these columns; if it were ever granted to someone else
-- by mistake they would hit the column privileges from migration 3 and fail.

create or replace function public.apply_stripe_subscription(
  p_customer_id          text,
  p_observed_at          timestamptz,
  p_subscription_id      text,
  p_status               public.subscription_status,
  p_interval             text        default null,
  p_current_period_end   timestamptz default null,
  p_cancel_at_period_end boolean     default false
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_facility public.facilities%rowtype;
begin
  if p_customer_id is null or p_observed_at is null or p_subscription_id is null or p_status is null then
    raise exception 'A customer, a subscription, a status and the time observed are all required.'
      using errcode = '22023';
  end if;

  select * into v_facility
    from public.facilities
   where stripe_customer_id = p_customer_id
     for update;

  if not found then
    return 'unlinked';
  end if;

  if v_facility.subscription_synced_at is not null and p_observed_at < v_facility.subscription_synced_at then
    return 'stale';
  end if;

  update public.facilities
     set stripe_subscription_id            = p_subscription_id,
         subscription_status               = p_status,
         subscription_interval             = case when p_interval in ('month', 'year') then p_interval end,
         subscription_current_period_end   = p_current_period_end,
         subscription_cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
         subscription_synced_at            = p_observed_at
   where id = v_facility.id;

  return 'applied';
end;
$$;

comment on function public.apply_stripe_subscription(text, timestamptz, text, public.subscription_status, text, timestamptz, boolean) is
  'Records a snapshot of a facility''s Stripe subscription. Service role only. Returns applied, stale (an older observation) or unlinked (no facility has that Stripe customer).';

revoke all on function public.apply_stripe_subscription(text, timestamptz, text, public.subscription_status, text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription(text, timestamptz, text, public.subscription_status, text, timestamptz, boolean)
  to service_role;
