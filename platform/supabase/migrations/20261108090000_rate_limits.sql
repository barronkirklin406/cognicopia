-- Rate limiting for the places a stranger can knock: sign-in, sign-up, password reset, an invitation link,
-- emailed invitations and the license redeem route. Supabase limits its own endpoints; this limits ours.
--
-- A fixed-window counter kept in the database, not in the server's memory: the app may run as many
-- short-lived copies at once, each with its own memory, so only a shared store can count honestly.
--
--   private.rate_limits   one row per (key, window): how many times the key was seen in that window.
--                         Keys are made by the server (lib/security/rate-limit.ts) and hold no address
--                         or name in the clear: a person's email is hashed before it is a key.
--   public.rate_limit_hit one call counts one hit and says whether the key is still within its limit.
--                         Callable by the server only (the service role).
--
-- The counter keeps counting after the limit is passed, so a caller that ignores "no" does not earn more.
-- Old windows are swept away now and then by the calls themselves; there is no job to set up.

create table private.rate_limits (
  key          text        not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  hits         integer     not null check (hits >= 1),
  primary key (key, window_start)
);

create index rate_limits_window_start_idx on private.rate_limits (window_start);

comment on table private.rate_limits is
  'Counts for rate limiting, one row per key and window. Written only by public.rate_limit_hit(). Holds no personal data in the clear.';

-- Nobody but the function (which runs as its owner) touches the table.
revoke all on table private.rate_limits from public, anon, authenticated, service_role;

create function public.rate_limit_hit(
  p_key            text,
  p_window_seconds integer,
  p_max            integer
)
returns table (allowed boolean, hits integer, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_end    timestamptz;
  v_hits   integer;
  v_now    timestamptz := clock_timestamp();
begin
  if p_key is null or char_length(p_key) not between 1 and 200
     or p_window_seconds is null or p_window_seconds not between 1 and 86400
     or p_max is null or p_max not between 1 and 100000 then
    raise exception 'A key, a window of 1 second to 1 day and a limit of 1 to 100000 are required.'
      using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_end    := v_window + make_interval(secs => p_window_seconds);

  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = least(r.hits + 1, 1000000)
  returning r.hits into v_hits;

  -- About one call in a hundred tidies up windows more than a day old (the longest window is a day).
  if random() < 0.01 then
    delete from private.rate_limits where window_start < v_now - interval '2 days';
  end if;

  return query select v_hits <= p_max, v_hits, greatest(1, ceil(extract(epoch from (v_end - v_now)))::integer);
end;
$$;

-- The server only: a signed-in user or a visitor has no business counting hits, or asking about anyone else's.
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
