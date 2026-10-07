# Cognicopia platform

The service for memory care facilities: Next.js (App Router) in front, Supabase (PostgreSQL and sign-in) behind, Stripe for subscriptions. This folder is separate from the public site in the repository root, which is plain HTML on GitHub Pages and is not changed by anything here.

**Zero PHI.** Nothing in this project stores a resident's name, a medical record or anything about a particular resident. It delivers content and plans activities for staff. How the data model holds to that, and where it cannot, is in [the architecture notes](../docs/saas-platform-architecture.md).

**Where it stands.**

- **Sign-in with roles.** Email and password, with email confirmation and password reset. An Activity Director is a facility *admin* (settings, team, billing); everyone else is *staff* (the activity library and the calendar). Staff join by an invitation link an admin makes.
- **Stripe billing.** Monthly and annual plans through Stripe Checkout, the Stripe billing portal, and a signed webhook that keeps each facility's `subscription_status` in step.
- **The subscription gate.** When a facility's subscription is past due, unpaid or ended, the activity library and the calendar tools close (in the pages, in the API and in the database) and an admin sees a renewal prompt with a button to the Stripe portal.
- **Not built yet.** The scheduling engine behind the calendar page (it shows saved calendars), emailing invitations, rate limiting, and continuous integration. The architecture notes list them in order.

## Run the tests

Needs Node 22.12 or newer. No Docker, no Supabase account and no Stripe account.

```bash
cd platform
npm install
npm test            # database rules, access rules, billing, auth flows, data layer, routes
npm run typecheck
npm run build       # also works with no settings: nothing reads them until a request arrives
```

The database tests apply the real migrations to an in-process PostgreSQL (PGlite), then check what each kind of user can read and change. The Stripe code is tested against a stand-in, with real webhook signatures, so nothing reaches the network.

## Run it against Supabase and Stripe

Needs the [Supabase CLI](https://supabase.com/docs/guides/local-development) and Docker for the local database, the [Stripe CLI](https://docs.stripe.com/stripe-cli) to forward webhooks, and a Stripe account in **test mode** (free; no real money moves).

```bash
cp .env.example .env.local   # then fill it in, as below
supabase start               # local Postgres, Auth and API; prints the keys for .env.local
supabase db reset            # applies supabase/migrations, then supabase/seed.sql
npm run dev                  # http://localhost:3000
stripe listen --forward-to localhost:3000/api/stripe/webhook   # in a second terminal; prints the whsec_ secret
```

### Every setting

All are documented, with where to find each one, in [`.env.example`](.env.example). A setting that is missing or malformed breaks only the feature that needs it, and the error names the setting, never its value.

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything | Safe in a page: row level security protects the data, not this key. Supabase's newer publishable key works here too. |
| `SUPABASE_SERVICE_ROLE_KEY` | billing | Server only. Skips row level security. Never give it a `NEXT_PUBLIC_` prefix, never log it. |
| `APP_URL` | sign-in emails, invitations, billing | The address people reach the app at, with no trailing slash. Never read from a request. |
| `STRIPE_SECRET_KEY` | billing | `sk_test_...` until you go live. |
| `STRIPE_WEBHOOK_SECRET` | the webhook | `whsec_...`, from `stripe listen` or the webhook endpoint's page. |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` | checkout | The two recurring prices (`price_...`). |
| `STRIPE_PORTAL_CONFIGURATION_ID` | optional | A saved portal configuration (`bpc_...`); empty uses Stripe's default. |
| `STRIPE_TRIAL_DAYS` | optional | A free trial on new subscriptions, 1 to 90 days; empty for none. |
| `STRIPE_API_BASE` | local testing only | Points the Stripe client at a stand-in server. Ignored in production. |

**This repository is public.** Only `.env.example`, which holds no real values, is committed. Keep real keys in `.env.local` or the host's settings.

### Set up Stripe (once, in test mode first)

1. **Products.** In the Dashboard (Product catalog) make one product for a facility subscription, with two recurring prices: monthly and annual. Copy the two price ids into `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL`.
2. **Customer portal.** Settings, Billing, Customer portal: turn on *update payment method* and *invoice history*, and, if you want customers to do it themselves, *cancel subscription* and *update subscription* (add the two prices as the products they may switch between). Save. The renewal prompt's "Update billing in Stripe" button opens this portal.
3. **Webhook.** Developers, Webhooks, add an endpoint `APP_URL/api/stripe/webhook` and select exactly these events: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `customer.subscription.created` and `checkout.session.completed`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`. (Locally, `stripe listen` stands in for the endpoint and prints its own secret.) Anything else that arrives is acknowledged and ignored.
4. **Keys.** Developers, API keys: the secret key goes in `STRIPE_SECRET_KEY`.

When you go live, repeat the steps with Test mode off. The live products, keys and webhook endpoint are separate from the test ones, and so are their ids and secrets.

### Set up Supabase (the hosted project)

Locally, `supabase/config.toml` already holds these. In the hosted project's dashboard:

1. **Authentication, URL Configuration.** Site URL: your `APP_URL`. Redirect URLs: `APP_URL/auth/callback`.
2. **Authentication, Providers, Email.** Keep *Confirm email* on (creating a facility and accepting an invitation both need a confirmed address). Set the minimum password length to 12, the same as the forms.
3. **Authentication, SMTP.** Supabase's built-in email sender is for trying things out and is very limited. Set up your own SMTP before real people sign up.
4. **Migrations.** `supabase link`, then `supabase db push`. The seed file is for local development and is not run by a push.
5. **API settings.** The Data API must expose only `public`: the `private` schema holds internal functions and is kept out of reach on purpose.

### Try the whole flow

1. Open `http://localhost:3000`, choose **Create account**, and sign up. Local emails land in the inbox the Supabase CLI prints (port 54324). Open the confirmation link in the same browser you signed up in (its one-time code only works there; opened elsewhere, the address is still confirmed and signing in with the password works), then sign in.
2. Set up a facility. You are its admin, and land on **Billing**.
3. **Choose monthly.** On Stripe's page use the test card `4242 4242 4242 4242`, any future expiry and any security code. You return to Billing, which asks Stripe at once and shows the subscription active; the library and calendar open.
4. **Team**, then **Create invitation link**. Open the link in a private window, create a second account, confirm it, and join as staff. Staff see no Team, Billing or Settings.
5. Close the gate: in the local database run `update public.facilities set subscription_status = 'past_due';` (with `supabase db` or any Postgres client on port 54322). The library and calendar now show the renewal prompt, and the admin's button opens the Stripe portal. The next webhook, or **Check my payment status**, puts back whatever Stripe says.

## Where things go

```
proxy.ts         Keeps sign-in fresh and turns away signed-out visitors (a courtesy, not the security).
app/             The UI and the HTTP edge: pages, server actions, route handlers (app/api).
components/      The page frame, forms, the renewal prompt, the billing buttons.
lib/domain/      Pure rules: the zero-PHI check, calendar and content schemas, subscription, plans, invitations.
lib/access/      Who is asking and what they may do: the rules (pure), page guards, route wrappers.
lib/auth/        Sign-in and set-up as plain functions, safe redirects, our wording for errors.
lib/billing/     Stripe: client, customer, checkout, portal, sync with Stripe, webhook.
lib/admin/       The team, settings and billing-check flows.
lib/data/        Every database query. Takes the client as an argument.
lib/supabase/    The three clients: browser, server (as the user), admin (service role).
lib/db/          Types: database.types.ts (Supabase's shape), models.ts (ours).
supabase/        Migrations, development seed, local settings.
tests/           db (real PostgreSQL), domain, access, auth, billing, data, admin, api.
```

Generation logic, activity templates and asset handling belong in `lib/`, never in `app/`.

`next dev` writes an `AGENTS.md` here (a Next.js 16.4 feature that points coding agents at the version's docs). It is not committed. To stop it, set `agentRules: false` in `next.config.ts`.

## Changing the database

1. Add a migration: `supabase migration new what_changed`. Never edit a migration that has been applied anywhere shared.
2. Update `lib/db/database.types.ts` to match. With the local stack running, `npm run db:types` regenerates it. It replaces the hand-written file with the CLI's output; `lib/db/models.ts` is separate and stays.
3. `npm test`. The types test compares the types with the migrated database and fails when they disagree.

Which subscription statuses open the premium tools is decided in two places, `lib/domain/subscription.ts` and `private.subscription_grants_access()` in migration 4. A test runs both over every status and fails if they disagree, so change them together.

## Deploying

Deploy this folder to a Node host. On Vercel, set the Root Directory to `platform` and add the variables above, with `APP_URL` set to the production address. Point a live-mode Stripe webhook endpoint at `APP_URL/api/stripe/webhook`. The public site keeps deploying from `main` to GitHub Pages as before. To create the hosted database, link the Supabase project and push the migrations (`supabase link`, then `supabase db push`), then set up Supabase as above.
