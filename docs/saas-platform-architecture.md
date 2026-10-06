# Facility platform: architecture

`platform/` is the start of Cognicopia as a B2B service for memory care facilities: Next.js (App Router) on the front, Supabase (PostgreSQL) behind it. This page covers what is built, why it is shaped this way, and what was decided on the way. The first task was the backend foundation, so what exists is the database schema, the access rules, the types, the typed clients and a thin set of API routes. There is no sign-in screen, dashboard, billing or invitation flow yet; those are the next tasks, listed at the end.

## Where it lives, and why

The public site (`cognicopia.org`) is plain HTML on GitHub Pages. It has no server and no accounts, and every packet tool keeps what staff type in the browser (`docs/privacy-and-storage.md`). GitHub Pages cannot run a Next.js server, and rewriting the repository root would put the live site at risk for no gain. So the platform is a separate project in `platform/`, with its own `package.json`, and the static site is untouched.

- It deploys to a Node host (Vercel, for example, with the root directory set to `platform`). The static site keeps deploying from `main` to GitHub Pages as before.
- The tools move across one at a time. When the last has moved and the platform serves the domain, promote `platform/` to the repository root.
- The only change outside `platform/` is that the site's own checks skip a `.next` build folder, so a local `next build` cannot confuse them.

The brief asked for `/app`, `/lib` and `/api`. In the App Router, API routes must live inside `app/` (a route is a folder under `app/` with a `route.ts` file), so `/api` is `app/api`. The separation it was meant to give is kept: routes only handle HTTP.

## Layout and the rules between the layers

```
platform/
  app/                    The UI and the HTTP edge. Nothing else.
    layout.tsx, page.tsx    A placeholder shell.
    api/                    Route handlers: authenticate, validate, call lib/data, answer.
      facilities/route.ts     POST: create my facility
      calendars/route.ts      GET, PUT: my facility's calendar for a month
      content/route.ts        GET: the shared activity library
  lib/
    domain/                 Pure rules. No I/O, no Next.js, no Supabase.
      phi-guard.ts            The zero-PHI tripwire
      calendar.ts, content.ts Strict schemas for the two JSON columns
    data/                   Every database query. Takes the client as an argument.
    supabase/               The three clients: browser, server (as the user), admin (service role)
    db/                     database.types.ts (Supabase's shape), models.ts (ours)
    auth.ts, http.ts, env.ts, env.server.ts
  supabase/
    migrations/             The schema, row level security and the access rules
    seed.sql                Sample content for development
    config.toml             Local Supabase settings
  tests/                    db (real Postgres), domain, data, api
```

1. `app/` never queries the database. It calls `lib/data`, directly from a server component or through a route.
2. Route handlers stay thin: who is asking, is the input valid, call one data function, map the result to a status. A rule that matters lives in `lib/domain` or in the database, never only in a route.
3. `lib/domain` imports nothing that does I/O, so it runs anywhere and is trivial to test.
4. `lib/data` functions take a database client and never choose one. The route decides who is acting. That keeps "as the user" versus "as the server" a visible decision at the edge.
5. The service role (`lib/supabase/admin.ts`, marked `server-only`) bypasses row level security. It is for what no signed-in user may do for themselves: billing status from a Stripe webhook, loading the library, inviting staff, offboarding a facility. It is never used to answer a user's own request for their own data.
6. Generation logic, activity templates and asset handling belong in `lib/` (a `lib/generation` folder is the natural home when the engines move over), never in `app/`.

## The data model

| Table | Holds | Notes |
|---|---|---|
| `facilities` | `id`, `facility_name`, `subscription_status`, `stripe_customer_id`, `created_at` | One row per customer (tenant). Status mirrors Stripe's subscription status, so a webhook copies it straight in. New facilities start in `trialing`. A Stripe customer can belong to only one facility. |
| `facility_users` | `id`, `facility_id`, `email`, `role` (`admin` or `staff`), `created_at` | `id` is the Supabase auth user id, so `auth.uid()` finds the membership directly. One account belongs to one facility. `email` is a copy of the sign-in email, kept in step by a trigger. |
| `content_items` | `id`, `title`, `category`, `dementia_stage` (`early`, `middle`, `late`, `universal`), `content_payload`, `created_at` | The shared library: global, not per tenant. `category` is a lowercase slug, so the list can grow without a migration. The stage has no default, on purpose: a silent `universal` could put an unsuitable activity in front of a late-stage group. |
| `activity_calendars` | `id`, `facility_id`, `month_year`, `generated_data`, `created_at` | One calendar per facility per month, so regenerating a month is an upsert. `month_year` is text (`2026-10`), not a date: a date parsed in a browser slips a day in time zones behind UTC. |

Constraints worth knowing: names are 1 to 120 characters; emails are stored lowercase; `generated_data` and `content_payload` must be JSON objects; a calendar is at most 1 MiB of JSON text and 11 levels deep.

The two JSON columns have versioned, strict shapes in `lib/domain` (`schema_version: 1`). They mirror what the existing facility planner holds (`src/services/facilityPlanner.ts`): groups with an acuity tier, and sessions that place an activity with a group at a date and time. They are provisional until the generation engines move over.

## Who can do what

Everything below is enforced by the database, not by application code, so it holds for the Data API, for the app and for anything else that reaches the database with a user's token.

| Table | Read | Write (signed in) |
|---|---|---|
| `facilities` | their own facility | an admin may change `facility_name`, and nothing else |
| `facility_users` | their own facility's team | an admin may change a member's `role` or remove a member |
| `content_items` | any facility member | nobody (the service role only) |
| `activity_calendars` | their own facility's | staff and admins of that facility: insert, update, delete |

Signed-out visitors can reach nothing. The service role bypasses all of it.

**Rows and columns.** Row level security decides which rows. A policy cannot decide which columns, so column privileges do that: an admin cannot update `subscription_status` or `stripe_customer_id` (billing is the server's), and cannot change a member's `facility_id` or `email`.

**No direct inserts into `facilities` or `facility_users`.** The one way in is `create_facility(name)`, which makes the caller the admin of a new facility in one transaction. It is `security definer`, so it checks everything itself: signed in, an email address that has been confirmed (read from the auth record, not the token), a valid name, and no facility yet. Anonymous sign-ins are refused. Inviting staff is done by the server with the service role. Supabase's database linter flags a security definer function that signed-in users can call; that is intended here.

**A facility always keeps an admin.** A trigger refuses to demote, remove or move the last admin (error `CG001`), and takes a lock on the facility row so two admins cannot demote each other at the same instant. Deleting a facility still works. Deleting the last admin's account is refused until the facility has another admin. (The lock is reasoned, not tested: the in-process test database has one connection.)

**Reading the caller's facility** uses two small security definer helpers in an unexposed `private` schema. Without them a policy on `facility_users` would have to read `facility_users` and recurse. Policies wrap the call in `(select ...)`, so it runs once per statement, not once per row.

**Errors.** Standard SQLSTATEs plus three of ours: `CG001` a facility must keep an admin, `CG002` this account already belongs to a facility, `CG003` no confirmed email. `lib/data/errors.ts` maps them to HTTP statuses.

## Zero PHI

The platform must never store protected health information. The existing tools already honour this by never leaving the browser, and the old planner shows why it needs a rule: its `Group` has a `residents` list. That list stays on the computer; it must never reach a server.

**What is stored.** Facility names; subscription status and the Stripe customer id; staff email addresses (personal data under privacy law, but not PHI); the shared content library; and calendars that plan groups: a group's name, acuity tier and head count, and sessions placing an activity with a group. Nothing refers to a resident.

**How the model enforces it, in layers.**

1. The schema has no resident table or column, and a test fails if one appears.
2. A calendar is validated against a strict schema (`lib/domain/calendar.ts`). A field it does not know is refused, so there is no place for a resident to be stored.
3. A resident-looking key anywhere in a calendar (`residents`, `patient_name`, `firstName`, `dob`, `diagnosis`, `roomNumber`, `email` and so on) is refused with its own error. The same list is a `CHECK` constraint in the database, which nothing can skip. A test runs the TypeScript and SQL versions on thousands of keys and random documents and fails if they disagree.
4. Size and depth limits stop a calendar from being used as free storage.
5. Errors and logs never carry the database's message or a row: a failing row could contain whatever a user typed.
6. The service agreement disclaims PHI. That is yours to write.

**What this cannot do.** It judges keys, not words. A resident's name typed into a session's `note`, or used as a group's name, passes every check. No automated rule can prove free text is clean. Reduce the risk with a visible warning beside every free-text field, short limits (notes are 140 characters), and the contract. If you want a stronger structural guarantee later, Supabase's `pg_jsonschema` extension can enforce the allowed shape inside the database once the shape settles.

## Checking it

From `platform/`: `npm install`, then `npm test` and `npm run typecheck`. Node 22.12 or newer.

The database tests run the real migrations, unchanged, in an in-process PostgreSQL (PGlite) on top of a small file that stands in for what Supabase provides (the three roles, its default privileges, and the `auth` schema with `auth.uid()`). Each test acts as a particular user inside a transaction that is rolled back.

There are 492 tests in 14 files.

- **Isolation and rights** (76): each person sees only their facility's rows; what staff, admins, signed-out visitors and the server can and cannot change; every column an admin may not touch; the last-admin rule; `create_facility` and every way it refuses; cascades.
- **Schema rules** (85): every constraint, the exact privileges of each role, and invariants that hold for every table and function (row level security on, every policy for signed-in users only, every security definer function pins its `search_path`).
- **The resident-key guard** (164): in the database, 72 key names refused and 37 accepted, nested and in arrays; in TypeScript, the same rules; and 6 tests that run both on the same thousands of keys and random documents and fail if they disagree.
- **Types** (18): the TypeScript types are compared with the migrated database (columns, which are optional on insert, enum values and order, the function).
- **Seed and size** (8): the sample content loads, and the largest calendar the schema allows fits inside the size cap.
- **Application** (141): schemas, error mapping, the data functions and the routes.

To check the tests are not passing for the wrong reason, twelve rules were deliberately weakened one at a time (a policy made unconditional, a `with check` removed, a column granted, the trigger dropped, row level security left off, the resident-key constraint removed). Every one made tests fail.

**Not verified here:** a real Supabase stack. Docker was not available, so `supabase start`, `supabase db reset` and `supabase test db` have not been run, and `supabase/config.toml` is hand-written. The test database is PostgreSQL 18 and Supabase runs 15 or 17; the SQL uses nothing newer than 15. On the first real run, confirm that the migrations apply, that the trigger on `auth.users` is created, that the Supabase linter's only warning is the intended one for `create_facility`, and that the `private` schema is not exposed.

## Decisions made for you

1. **A subfolder, not the repository root,** for the reasons above.
2. **One facility per account** (`facility_users.id` is the auth user id), because the brief says "their specific facility". A person who works across facilities needs a membership table and a way to pick the current one.
3. **Subscription status starts as `trialing`** and is not enforced in the database. Whether a lapsed or past-due facility keeps access is a business decision with a patient-care edge: cutting off calming activities over a payment hiccup has a real cost. The Stripe webhook will set the status; where to gate on it is yours.
4. **Any facility member can read the whole library.** Entitlement is not checked at the data layer yet.
5. **One calendar per facility per month,** holding every wing. The month is capped at 1 MiB, about 2,400 sessions at full length. If you need per-wing rows, drop the unique constraint and add a unit column.
6. **Staff and admins can both write calendars,** as asked, including deleting them.
7. **Columns not in the brief were left out:** `updated_at`, `trial_ends_at`, `current_period_end`, `stripe_subscription_id`. You will probably want the last three for billing.

## Next

1. Sign-in and sign-up screens, the session proxy, and a dashboard that calls `lib/data`.
2. The invitation flow with the service role (it must check the caller is an admin of that facility).
3. The Stripe webhook that writes `subscription_status`, and the decision in item 3 above.
4. Move the generation engines into `lib/generation` and the content library into `content_items` through a loading script.
5. Continuous integration for `platform/` (this environment could not add a workflow file), security headers, and rate limiting on sign-up.
