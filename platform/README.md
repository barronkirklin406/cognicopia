# Cognicopia platform

The service for memory care facilities: Next.js (App Router) in front, Supabase (PostgreSQL) behind. This folder is separate from the public site in the repository root, which is plain HTML on GitHub Pages and is not changed by anything here.

**Zero PHI.** Nothing in this project stores a resident's name, a medical record or anything about a particular resident. It delivers content and plans activities for staff. How the data model holds to that, and where it cannot, is in [the architecture notes](../docs/saas-platform-architecture.md).

**Where it stands.** This is the backend foundation: the database schema, the access rules, the types, typed clients and a few API routes. There are no sign-in screens, dashboard, billing or invitations yet; the notes list them as next.

## Run the tests

Needs Node 22.12 or newer. No Docker and no Supabase account.

```bash
cd platform
npm install
npm test            # database rules, domain rules, data layer and routes
npm run typecheck
```

The database tests apply the real migrations to an in-process PostgreSQL (PGlite), then check what each kind of user can read and change.

## Run it against Supabase

Needs the [Supabase CLI](https://supabase.com/docs/guides/local-development) and Docker.

```bash
cp .env.example .env.local   # fill in the keys that the next command prints
supabase start               # local Postgres, Auth and API
supabase db reset            # applies supabase/migrations, then supabase/seed.sql
npm run dev                  # http://localhost:3000
```

| Variable | Where it is used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and server | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser and server | Safe in a page: row level security protects the data, not this key. Supabase's newer publishable key works here too. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Skips row level security. Never give it a `NEXT_PUBLIC_` prefix, never log it. |

**This repository is public.** Only `.env.example` is committed, and it holds no real values. Keep real keys in `.env.local` or the host's settings.

## Where things go

```
app/          The UI and the HTTP edge. App Router route handlers are in app/api.
lib/domain/   Pure rules: the zero-PHI check, calendar and content schemas.
lib/data/     Every database query. Takes the client as an argument.
lib/supabase/ The three clients: browser, server (as the user), admin (service role).
lib/db/       Types: database.types.ts (Supabase's shape), models.ts (ours).
supabase/     Migrations, development seed, local settings.
tests/        db (real PostgreSQL), domain, data, api.
```

Generation logic, activity templates and asset handling belong in `lib/`, never in `app/`.

## Changing the database

1. Add a migration: `supabase migration new what_changed`. Never edit a migration that has been applied anywhere shared.
2. Update `lib/db/database.types.ts` to match. With the local stack running, `npm run db:types` regenerates it. It replaces the hand-written file with the CLI's output; `lib/db/models.ts` is separate and stays.
3. `npm test`. The types test compares the types with the migrated database and fails when they disagree.

## Deploying

Deploy this folder to a Node host. On Vercel, set the Root Directory to `platform` and add the three variables above. The public site keeps deploying from `main` to GitHub Pages as before. To create the hosted database, link the Supabase project and push the migrations (`supabase link`, then `supabase db push`). The seed file is for local development and is not run by a push.
