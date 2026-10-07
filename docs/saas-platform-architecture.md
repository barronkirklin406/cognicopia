# Facility platform: architecture

`platform/` is Cognicopia as a B2B service for memory care facilities: Next.js (App Router) on the front, Supabase (PostgreSQL and Auth) behind it, Stripe for subscriptions. This page covers what is built, why it is shaped this way, and what was decided on the way. It was built in two steps. The first was the backend foundation: the database schema, the access rules, the types, the typed clients and a thin set of API routes. The second, described from [Sign-in, roles and invitations](#sign-in-roles-and-invitations) on, added sign-in with roles, invitations, Stripe billing with a webhook, and the subscription gate. To set it up and run it, read [`platform/README.md`](../platform/README.md); every setting is explained in [`platform/.env.example`](../platform/.env.example).

## Where it lives, and why

The public site (`cognicopia.org`) is plain HTML on GitHub Pages. It has no server and no accounts, and every packet tool keeps what staff type in the browser (`docs/privacy-and-storage.md`). GitHub Pages cannot run a Next.js server, and rewriting the repository root would put the live site at risk for no gain. So the platform is a separate project in `platform/`, with its own `package.json`, and the static site is untouched.

- It deploys to a Node host (Vercel, for example, with the root directory set to `platform`). The static site keeps deploying from `main` to GitHub Pages as before.
- The tools move across one at a time. When the last has moved and the platform serves the domain, promote `platform/` to the repository root.
- The only change outside `platform/` is that the site's own checks skip a `.next` build folder, so a local `next build` cannot confuse them.

The brief asked for `/app`, `/lib` and `/api`. In the App Router, API routes must live inside `app/` (a route is a folder under `app/` with a `route.ts` file), so `/api` is `app/api`. The separation it was meant to give is kept: routes only handle HTTP.

## Layout and the rules between the layers

```
platform/
  proxy.ts                  Keeps sign-in fresh, turns away signed-out visitors. A courtesy, not the security.
  app/                      The UI and the HTTP edge. Nothing else.
    page.tsx, login, signup, forgot-password, reset-password    Public pages
    onboarding, join        Set up a facility; accept an invitation
    dashboard, library, calendar   Everyone in a facility (the last two need a subscription)
    admin/                  Activity Directors only: team, billing, settings
    actions.ts, admin/actions.ts   Server actions: thin skins over lib/auth and lib/admin
    auth/callback           Where the links in our emails come back to
    api/                    Route handlers: authenticate, validate, call lib, answer
      stripe/checkout, portal, webhook
      facilities, calendars, content
  components/               The page frame, forms, the renewal prompt, the billing buttons
  lib/
    domain/                 Pure rules. No I/O, no Next.js, no Supabase.
      phi-guard, calendar, content    The zero-PHI tripwire and the two JSON column schemas
      subscription, plans, invite, auth, months, stripe-url
    access/                 Who is asking, and what they may do
      context, policy         One query for the person and their facility; the rules as pure functions
      guards, with-access     Page guards; route wrappers
    auth/                   Sign-in and set-up as plain functions, safe redirects, our wording for errors
    billing/                Stripe: client, customer, checkout, portal, sync, webhook, reconcile
    admin/                  Team, settings and billing-check flows
    data/                   Every database query. Takes the client as an argument.
    supabase/               The three clients: browser, server (as the user), admin (service role)
    db/                     database.types.ts (Supabase's shape), models.ts (ours)
    env.ts, env.server.ts, errors.ts, http.ts
  supabase/
    migrations/             The schema, row level security and the access rules (five files)
    seed.sql                Sample content for development
    config.toml             Local Supabase settings
  tests/                    db (real Postgres), domain, access, auth, billing, data, admin, api
```

1. `app/` never queries the database. It calls `lib/data`, directly from a server component or through a route.
2. Route handlers and server actions stay thin: who is asking, is the input valid, call one function, map the result. A rule that matters lives in `lib/domain`, `lib/access` or the database, never only in a route.
3. `lib/domain` imports nothing that does I/O, so it runs anywhere and is trivial to test.
4. `lib/data` functions take a database client and never choose one. The route decides who is acting. That keeps "as the user" versus "as the server" a visible decision at the edge.
5. The service role (`lib/supabase/admin.ts`, marked `server-only`) bypasses row level security. It is for what no signed-in user may do for themselves. Today that is recording a facility's Stripe customer and subscription status. It is never used to answer a user's own request for their own data.
6. Every page, server action and route checks for itself who is asking. The proxy is not the security: Next.js advises against more than optimistic checks there, a layout is not rendered again when someone moves between pages inside it, and a server action can be called without its page.
7. Generation logic, activity templates and asset handling belong in `lib/` (a `lib/generation` folder is the natural home when the engines move over), never in `app/`.

## The data model

| Table | Holds | Notes |
|---|---|---|
| `facilities` | `id`, `facility_name`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_interval`, `subscription_current_period_end`, `subscription_cancel_at_period_end`, `subscription_synced_at`, `created_at` | One row per customer (tenant). The status mirrors Stripe's subscription status, so the webhook copies it straight in. A new facility starts as `incomplete` (no subscription yet). A Stripe customer, and a Stripe subscription, can belong to only one facility. Only the server writes the billing columns. |
| `facility_users` | `id`, `facility_id`, `email`, `role` (`admin` or `staff`), `created_at` | `id` is the Supabase auth user id, so `auth.uid()` finds the membership directly. One account belongs to one facility. `email` is a copy of the sign-in email, kept in step by a trigger. |
| `facility_invites` | `id`, `facility_id`, `token_hash`, `email`, `role`, `created_by`, `created_at`, `expires_at`, `accepted_at`, `accepted_by` | Invitations to join a facility. Holds only the SHA-256 of the secret in the link, never the secret. |
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
| `facility_invites` | an admin of that facility (never the hash) | an admin may cancel an invitation that has not been used |
| `content_items` | a member of a facility whose subscription grants access | nobody (the service role only) |
| `activity_calendars` | their own facility's, whatever its subscription | staff and admins of a facility whose subscription grants access: insert, update, delete |

Signed-out visitors can reach nothing. The service role bypasses all of it.

**Rows and columns.** Row level security decides which rows. A policy cannot decide which columns, so column privileges do that: an admin cannot update `subscription_status` or any other billing column (billing is the server's), and cannot change a member's `facility_id` or `email`.

**No direct inserts into `facilities` or `facility_users`.** There are two ways in. `create_facility(name)` makes the caller the admin of a new facility in one transaction, and `accept_facility_invite(secret)` adds the caller to the facility that issued the invitation. Both are `security definer`, so they check everything themselves: signed in, an email address that has been confirmed (read from the auth record, not the token), no facility yet. Anonymous sign-ins are refused. Supabase's database linter flags a security definer function that signed-in users can call; that is intended here.

**A facility always keeps an admin.** A trigger refuses to demote, remove or move the last admin (error `CG001`), and takes a lock on the facility row so two admins cannot demote each other at the same instant. Deleting a facility still works. Deleting the last admin's account is refused until the facility has another admin. (The lock is reasoned, not tested: the in-process test database has one connection.)

**Reading the caller's facility** uses small security definer helpers in an unexposed `private` schema. Without them a policy on `facility_users` would have to read `facility_users` and recurse. Policies wrap the call in `(select ...)`, so it runs once per statement, not once per row.

**Errors.** Standard SQLSTATEs plus five of ours: `CG001` a facility must keep an admin, `CG002` this account already belongs to a facility, `CG003` no confirmed email, `CG004` the invitation is not valid (unknown, used or expired), `CG005` it was sent to a different email address. `lib/data/errors.ts` maps them to HTTP statuses and to wording safe to show.

## Sign-in, roles and invitations

**Supabase Auth, email and password.** A person signs up, confirms their address from the email Supabase sends, and signs in. Confirmation matters: `create_facility` and `accept_facility_invite` both require it, so a facility cannot be claimed with an address someone does not own. The session lives in cookies (`@supabase/ssr`, PKCE flow). The link in the email comes back to `app/auth/callback`, which exchanges its one-time code for a session and goes on to the page the link named, but only if that page is on this site. With the PKCE flow that code can only be used in the browser that asked for it, so a link opened on another device cannot sign anyone in; Supabase has confirmed the address by then, so the sign-in page says that signing in with the password will work.

**Facility-wide login: one sign-in per person, joined by invitation.** The brief asked for staff to get in "using facility credentials or invite links". Both are served by invitation links; there are no shared facility credentials, on purpose:

- A password shared by a whole team cannot be taken away from one person who leaves, so removing a member would mean changing it for everyone.
- Nothing can say who did what, and sign-in cannot be protected per person (for example with a second factor later).
- Supabase Auth identifies people, not facilities, and so does every rule in the database. A facility login would be an account that belongs to nobody.

A facility that wants one login on a shared computer can invite a mailbox it controls (a shared inbox), which then holds an ordinary account. An admin makes an invitation on the Team page, optionally tied to one email address and either role, and shares the link themselves. The person opens it, signs in or creates their own account (the invitation survives the trip through sign-up and email confirmation), and accepts. The secret is 64 hex characters from the database's random source; only its SHA-256 is stored, so even a read of the table cannot yield a working link. An invitation works once, lasts 7 days, can be cancelled until it is used, and a facility may have at most 50 open at once. A link tied to an address refuses any other account.

**Roles and where each one goes.** There are two: `admin` (the Activity Director, who manages the facility) and `staff`. After signing in everyone lands on their dashboard, or on the page they were heading to if it is on this site; what the dashboard offers follows the role.

| Page | Signed out | Staff | Admin |
|---|---|---|---|
| `/`, `/login`, `/signup`, `/forgot-password` | the page | to the dashboard | to the dashboard |
| `/join` (an invitation) | sign in, or create an account | accept it (if they have no facility) | the same |
| `/onboarding` (set up a facility) | to sign-in | to the dashboard, if they have a facility | the same |
| `/dashboard` | to sign-in | yes | yes, with the management tiles |
| `/library`, `/calendar` | to sign-in | yes, with a subscription | yes, with a subscription |
| `/admin/team`, `/admin/billing`, `/admin/settings` | to sign-in | back to the dashboard, with a note | yes |
| `/api/stripe/checkout`, `/api/stripe/portal` | 401 | 403 | yes |

**Where the checks are, from the outside in.**

1. `proxy.ts` reads the session cookie, renews it if it is about to expire, and turns away a signed-out visitor politely. It cannot see the database, so it knows nothing of roles or subscriptions.
2. Each page calls a guard (`requireMember`, `requireAdmin`, `requirePremium` in `lib/access/guards.ts`) before it touches any data. The guard asks Supabase Auth to verify the session (`getUser`, never the cookie's own word), then reads the person's membership and facility in one query, as them. The decisions themselves are pure functions (`lib/access/policy.ts`), tested without a server.
3. Each server action re-checks for itself, because a server action is a public endpoint however it is used. Route handlers use the `withUser` and `withAccess` wrappers (`lib/access/with-access.ts`), which answer 401, 403 or 402 as JSON and refuse a browser request from another site when it would change something.
4. The database is the last wall (row level security, above).

## Billing with Stripe

Stripe is the system of record. The database holds a copy, so a page can answer without calling Stripe, and the copy can always be rebuilt by asking Stripe again.

**Plans.** Monthly and annual (`lib/domain/plans.ts`). A browser can only ask for a plan by name; the Stripe price for each is a server setting (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`), so nobody can ask for some other price. To add a tier, add its id there, a price variable in `lib/env.server.ts` and `.env.example`.

**Starting a subscription: `POST /api/stripe/checkout`** with `{ "plan": "monthly" | "annual" }`, for admins only. It makes (or reuses) the facility's Stripe customer, holding only the facility's name, the admin's email as the billing contact and the facility's id. The request carries an idempotency key made from the facility and those details, so a double click cannot make two customers. Then it creates a Checkout Session in subscription mode, carrying the facility's id on the session and on the subscription, and returns Stripe's address. A facility that already has a live subscription gets 409 and is pointed at the billing portal, because a second subscription would bill it twice. The browser only follows an address that really is on `stripe.com`. A free trial is optional (`STRIPE_TRIAL_DAYS`); with none set, a facility pays when it subscribes.

**Managing it: `POST /api/stripe/portal`**, for admins only, makes a billing portal session for the facility's customer. In the portal they update their card, read invoices, change plan or cancel, and Stripe tells the webhook what they did. This is also the "update billing" link on the renewal prompt.

**Staying in step: `POST /api/stripe/webhook`.** The handler:

1. Reads the body as text, never parsed first, and verifies Stripe's signature over those exact bytes with the endpoint's signing secret. A missing or wrong signature, or a message more than five minutes old, is a 400 and nothing else happens.
2. Looks only at which customer the event is about. It does not trust the event's payload, its order or its API version.
3. Asks Stripe for that customer's subscriptions, picks the one that counts (one that grants access beats one in trouble, which beats one not yet paid for, which beats one that has ended; the newest wins a tie) and records it through `apply_stripe_subscription()`. That function finds the facility by its Stripe customer and refuses to go backwards: the time is noted before Stripe is asked and recorded with the answer, so a late answer to an early question never replaces a newer one.
4. Answers 200 for an event handled or deliberately ignored, 400 for a bad signature and 500 when Stripe or the database failed, so that Stripe retries.

The events to subscribe it to are `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`, as asked, plus `customer.subscription.created` and `checkout.session.completed` so access begins the moment a facility has paid. Anything else that arrives is acknowledged and ignored. Because each event only says "look at this customer", duplicated, late or reordered events all lead to the same result, and an unknown future status from Stripe is recorded as `unpaid`, so it can never open the premium tools.

**Coming back from Stripe.** When an admin returns from Checkout or from the portal, the billing page does not wait for the webhook, which can be seconds late (or missing if it was set up wrongly): it asks Stripe at once, with the same call the webhook makes, so the person sees their real status. "Check my payment status" on the billing page does the same on demand.

**Stripe's statuses and what they do here.**

| Status | Opens the library and calendar tools | What the admin is offered |
|---|---|---|
| `active`, `trialing` | yes | the billing portal; "Renews on…" |
| `past_due`, `unpaid`, `paused` | no | update billing in Stripe |
| `incomplete`, `incomplete_expired`, `canceled` | no | choose a plan |

## The subscription gate

When a facility's subscription is expired or past due, the premium tools close and an admin is shown how to put it right. "Premium" means the activity library and the calendar tools. Everything that is the facility's own stays open: signing in, the team, the settings, billing, and reading its own saved calendars, so nothing a facility has made is held hostage to a payment.

It is held in three places, so no one of them is the only guard:

1. **The pages** (`/library`, `/calendar`) call `requirePremium`, which does not redirect a lapsed facility but returns `blocked`, and the page draws the renewal prompt instead of any data, before it reads any. The dashboard shows a banner and marks the two tools "Subscription needed".
2. **The routes** (`/api/content`, `/api/calendars`) are wrapped with `withAccess({ premium: true })` and answer 402 with the status and whether the caller can manage billing.
3. **The database** (migration 4) closes the library to members of a lapsed facility and closes writing a calendar to them. This is the wall that holds against someone calling Supabase's Data API directly with their own token.

**The renewal prompt** (`components/RenewalPrompt.tsx`) says in plain words what happened, that nothing has been lost, and gives the way back in one click: an admin whose payment failed gets a button straight to Stripe's billing portal; an admin with no live plan gets the plans; staff are told to ask a facility admin, usually the Activity Director, and are shown nothing they cannot use.

**Past due closes the tools at once.** The brief says a past-due facility is blocked, so that is what happens: only `active` and `trialing` grant access. Stripe retries a failed card for a while first, so this will occasionally close the tools over a hiccup that fixes itself. If you would rather give a grace period, change the list in two places, `lib/domain/subscription.ts` and `private.subscription_grants_access()` in migration 4, together. A test runs both over every status and fails if they disagree.

## Zero PHI

The platform must never store protected health information. The existing tools already honour this by never leaving the browser, and the old planner shows why it needs a rule: its `Group` has a `residents` list. That list stays on the computer; it must never reach a server.

**What is stored.** Facility names; subscription status and Stripe ids; staff email addresses and the roles they hold (personal data under privacy law, but not PHI); invitations (a hash and, if the admin chose, an address); the shared content library; and calendars that plan groups: a group's name, acuity tier and head count, and sessions placing an activity with a group. Nothing refers to a resident. Stripe holds the facility's name and the billing contact's email, and nothing else.

**How the model enforces it, in layers.**

1. The schema has no resident table or column, and a test fails if one appears.
2. A calendar is validated against a strict schema (`lib/domain/calendar.ts`). A field it does not know is refused, so there is no place for a resident to be stored.
3. A resident-looking key anywhere in a calendar (`residents`, `patient_name`, `firstName`, `dob`, `diagnosis`, `roomNumber`, `email` and so on) is refused with its own error. The same list is a `CHECK` constraint in the database, which nothing can skip. A test runs the TypeScript and SQL versions on thousands of keys and random documents and fails if they disagree.
4. Size and depth limits stop a calendar from being used as free storage.
5. Errors and logs never carry the database's message, Stripe's message or a row: a failing row could contain whatever a user typed.
6. The service agreement disclaims PHI. That is yours to write.

**What this cannot do.** It judges keys, not words. A resident's name typed into a session's `note`, or used as a group's name, passes every check. No automated rule can prove free text is clean. Reduce the risk with a visible warning beside every free-text field, short limits (notes are 140 characters), and the contract. The settings and onboarding pages already carry that warning. If you want a stronger structural guarantee later, Supabase's `pg_jsonschema` extension can enforce the allowed shape inside the database once the shape settles.

## Security notes

- **Secrets.** The Supabase service key, Stripe secret key and webhook secret are read only on the server (`server-only` fails the build if a client component imports them). A missing or malformed setting raises an error that names the setting, never its value. This repository is public: only `.env.example`, with placeholders, is committed.
- **Redirects.** `next` after sign-in, and the destination after an emailed link, are accepted only if they are a path on this site: not another host, not `//host`, not a backslash trick, not control characters, not an API route or the auth callback. Anything else becomes the dashboard.
- **No account enumeration.** "Forgot password" gives the same answer whether or not the address has an account, and Supabase's sign-up does too. Our own wording is shown for every failure; Supabase's messages never reach a page.
- **Forged requests.** State-changing routes refuse a browser request whose `Origin` is another site, and accept only `Content-Type: application/json`, which a browser cannot send cross-site without a preflight. Cookies are `SameSite=Lax`.
- **Response headers** on every page: no framing (`X-Frame-Options`, `frame-ancestors`), `Referrer-Policy: no-referrer` (an invitation link carries its secret in its address and must never be passed on to another site), `nosniff`, a restrictive `Permissions-Policy`, forms may post only to this site, and `Strict-Transport-Security` in production.
- **Webhook.** Verified before anything else, over the raw bytes, with a five-minute tolerance; never trusted for its contents (above).
- **Passwords** must be 12 to 72 characters when chosen. Sign-in only asks that something was typed, so nobody is locked out by a rule that changed after they chose theirs. Set the same minimum in Supabase's own settings, because anyone can call its sign-up address without using our forms.

## Checking it

From `platform/`: `npm install`, then `npm test` and `npm run typecheck`. Node 22.12 or newer.

The database tests run the real migrations, unchanged, in an in-process PostgreSQL (PGlite) on top of a small file that stands in for what Supabase provides (the three roles, its default privileges, and the `auth` schema with `auth.uid()`). Each test acts as a particular user inside a transaction that is rolled back.

There are 1,236 tests in 35 files.

- **Isolation and rights**: each person sees only their facility's rows; what staff, admins, signed-out visitors and the server can and cannot change; every column an admin may not touch; the last-admin rule; `create_facility` and every way it refuses; cascades.
- **The subscription gate and billing**: for every status, whether the library opens and whether a calendar can be written, in the database and in TypeScript, compared; `apply_stripe_subscription` (applied, stale, unlinked, who may call it, every column it writes); billing columns that a tenant cannot write.
- **Invitations**: who can create, see, cancel, preview and accept; wrong address; used, expired and cancelled links; the cap; the secret is never stored and the hash cannot be read by anyone signed in.
- **Schema rules**: every constraint, the exact privileges of each role, and invariants that hold for every table and function (row level security on, every policy for signed-in users only and pinned to the caller's facility, every security definer function pins its `search_path`).
- **The resident-key guard**: the same rules in the database and in TypeScript, on thousands of keys and random documents.
- **Types**: the TypeScript types are compared with the migrated database (columns, which are optional on insert, enum values and order, every public function).
- **Application**: schemas and error mapping; the access rules for every combination of signed-in, role and status; safe redirects; the sign-in and set-up flows; the Stripe client calls (with a stand-in Stripe, so none reaches the network); the webhook with real signatures (right, wrong, missing, old, altered); the routes.

**Mutation checks.** To check the tests are not passing for the wrong reason, 46 database rules rules were deliberately weakened one at a time (a policy made unconditional, a `with check` removed, a column granted, a trigger dropped, the subscription list widened, a staleness guard removed, an invitation made reusable, and more). Every one made tests fail. The first pass missed one: a calendar policy that did not pin the caller's facility was hidden by the read policy that Postgres also applies, which led to tests that run statements with no filter, and a structural test that every policy on a tenant table mentions the caller's facility. Twenty weakenings of the TypeScript rules were tried the same way (who may enter an admin page or call an admin route, the subscription checks, the redirect rules, the same-origin check, the order of the sync, the webhook's event filter, checkout's guards, the key and address checks). One slipped through: nothing tested the check that the browser only ever goes to Stripe, so the test was written. Another changes nothing, because the next check in the redirect rule refuses the same address, so it is not a gap.

**In a real browser, against stand-ins.** The sign-in and billing screens were driven in Chromium with Playwright, against `next dev`, a stand-in for Supabase (sign-in, sessions that rotate and expire, and the part of the Data API the app uses, with the same row level rules) and a stand-in for Stripe. 233 checks cover signing in and out, roles, invitations through sign-up and email confirmation, password reset, the gate for every kind of person, Checkout and the portal (what is sent to Stripe is asserted), signed webhooks changing what the library shows, session renewal and a refresh token used twice. It found a real fault that no unit test could: the billing page, returning from Stripe, read the facility again after refreshing it and was handed the old answer, because Next.js shares the answer to a repeated GET within one render. The page now reads the result back with a different request, and a test pins the order. It also found three smaller faults in the screens, now fixed: the confirmation after cancelling an invitation or removing a person vanished with the row it was in (it now appears at the top of the page and takes keyboard focus, so a screen reader reads it); a role menu in the team table was under the 44 px target size; and visually hidden table labels widened the page at 320 px. Every signed-in page was also checked at 1280, 390 and 320 px for horizontal overflow, labels, target size, one heading and one main landmark. These stand-ins are not part of the repository.

**Not verified here.**

- **A real Supabase stack.** Docker was not available, so `supabase start`, `supabase db reset` and `supabase test db` have not been run, and `supabase/config.toml` is hand-written. The test database is PostgreSQL 18 and Supabase runs 15 or 17; the SQL uses nothing newer than 15. On the first real run, confirm that the migrations apply, that the trigger on `auth.users` is created, that the Supabase linter's only warnings are the intended ones for the security definer functions signed-in users call, that the `private` schema is not exposed, that confirmation and reset emails arrive and their links work (the callback expects a one-time `code`), and that sign-in works with your project's JWT signing keys (the stand-in used the older shared-secret kind, for which the proxy asks Supabase to verify the token; newer projects use asymmetric keys, which the client checks locally).
- **A real Stripe account.** The calls are checked against the SDK's types and a stand-in, not the live API. Run one test-mode checkout end to end (card `4242 4242 4242 4242`), watch the webhook arrive, and open the portal. The first live run is where a mistake in the prices, the portal configuration or the webhook's events would show.
- **Email delivery.** Supabase's built-in sender is for trying things out and is heavily rate-limited. Configure your own SMTP before real users sign up.
- **Concurrency in the database.** The row locks (the last admin, one apply at a time, accepting one invitation) are reasoned, not tested: the in-process database has one connection.

## Decisions made for you

1. **A subfolder, not the repository root,** for the reasons above.
2. **One facility per account** (`facility_users.id` is the auth user id), because the brief says "their specific facility". A person who works across facilities needs a membership table and a way to pick the current one.
3. **A new facility starts with no subscription** (`incomplete`), not in a free trial. Stripe is the system of record, so a trial, if you want one, is a Stripe trial on the subscription (`STRIPE_TRIAL_DAYS`) and ends when Stripe says it does. This changes what the first version of this page said.
4. **Past due blocks the premium tools at once,** as the brief says. See the subscription gate for how to add a grace period, and the cost of not having one.
5. **Invitation links, not shared facility credentials,** for the reasons given under sign-in. If you still want a kiosk-style login, invite a shared mailbox.
6. **The webhook asks Stripe rather than trusting the event,** and listens to two events more than the three asked for, so that access starts when a facility pays and a failed first payment is seen.
7. **Calendars stay readable to a lapsed facility** at the database level, so its saved plans are never held back. The app still closes the calendar page and API, which are premium tools. Making the data unreadable too is a one-policy change.
8. **The plan is chosen by name, not by price,** so a browser can never ask for some other price.
9. **Staff and admins can both write calendars,** as asked, including deleting them, while the subscription grants access.
10. **One calendar per facility per month,** holding every wing. The month is capped at 1 MiB, about 2,400 sessions at full length. If you need per-wing rows, drop the unique constraint and add a unit column.
11. **Everyone in a facility can read the whole library** while it is subscribed. Per-facility entitlements (different tiers seeing different content) are not built.

## Next

1. The scheduling engine behind the calendar page, so a director can make a month's plan (today the page shows what has been saved), and the library page's per-activity detail.
2. Email the invitation, instead of showing the link to share. It needs your own SMTP and a template, and the invitation functions already return what is needed.
3. Rate limiting on sign-in, sign-up and the invitation page (Supabase limits its own endpoints; ours are not limited yet), and a Content-Security-Policy for scripts, which needs per-request nonces.
4. Continuous integration for `platform/` (this environment could not add a workflow file), and a committed browser test of the sign-in and billing flows to replace the throwaway one.
5. Move the generation engines into `lib/generation` and the content library into `content_items` through a loading script.
6. Stack the team tables on a phone: at 390 px they scroll sideways inside their frame, which is usable but hides the Remove button. Admins at a desk or on a tablet are not affected.
7. Decide where the public site's wording ("no server, no accounts") should change once facilities sign in; today the platform is a separate project and the public site says nothing about it.
