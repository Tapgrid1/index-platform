# Deploying to Vercel

The app runs on Vercel as-is: `next build` needs no network and no database, so
a build succeeds before any environment variable is set. Nothing is
prerendered — every route in the build output is marked `ƒ` (server-rendered on
demand), because each one either reads the session cookie or queries Postgres.
That is what makes the build database-free, and it is also why a deployment with
no `DATABASE_URL` builds green and then fails on every request.

Two things therefore have to exist before the site is usable: a Postgres
database reachable from Vercel's runtime, and the environment variables below.

## 1. Database

Vercel's runtime is serverless, so each function instance opens its own
connections. Use a provider with a pooler — Neon and Supabase both work — and
point the two URLs at different endpoints, as `prisma/schema.prisma` explains:

| Variable | Endpoint | Used by |
|---|---|---|
| `DATABASE_URL` | transaction pooler, with `?pgbouncer=true` | every request |
| `DIRECT_URL` | direct connection | `prisma db push` and `migrate` only |

The pooler cannot run DDL and does not support prepared statements. With no
pooler in play, set both to the same value.

### Mapping Neon's injected variables

The Neon integration in the Vercel marketplace injects its own variable names,
and none of them is `DIRECT_URL`. Adding the integration alone therefore leaves
the app with no direct connection, so copy the two values across by hand:

| This app reads | Set it to the value Neon injects as |
|---|---|
| `DATABASE_URL` | `POSTGRES_PRISMA_URL` — pooled, already carries `pgbouncer=true` |
| `DIRECT_URL` | `POSTGRES_URL_NON_POOLING` |

Neon also injects a `DATABASE_URL` of its own, pointing at the pooler without
the `pgbouncer=true` parameter. Prisma will then try to use prepared statements
the pooler cannot handle, so overwrite it rather than leaving it as delivered.

There is no `prisma/migrations` directory yet, so the schema is created by push
rather than by migration. Run this once against the new database, from a machine
that has the repo checked out:

```bash
npx prisma db push
psql "$DIRECT_URL" -f prisma/sql/constraints.sql
npm run db:seed   # optional; sample stores and forum content
```

`constraints.sql` carries the CHECK constraints Prisma cannot express. Skipping
it leaves the five-slot product cap enforced only in application code.

## 2. Environment variables

Set these on the Vercel project for both Production and Preview. Preview
deployments get a different hostname on every push, so leave `AUTH_URL` unset
there and let Auth.js derive the host — it trusts `VERCEL_URL` automatically
because Vercel sets `VERCEL=1` in the build and runtime environment.

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET` — generate with `openssl rand -base64 32`

Optional, each independently:

- `AUTH_URL` — production only, once a custom domain is attached
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — Google sign-in
- `AUTH_APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` — Apple
  sign-in. Leave unset and Apple stays off without affecting other providers.
- `RESEND_API_KEY`, `EMAIL_FROM` — with no key, sends go to the server log
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — read by the seed script only
- `RESOLVER_FALLBACK_URL` — where `/r/:code` sends an unknown or expired scan

## 3. Project settings

The live project is `tapgrid-index-platform` in the `tapgrid-projects` team,
linked to this repository, so every push builds a preview and `main` builds
production. Framework detection handles the rest; no `vercel.json` is needed.

- Build command: `npm run build`, which is `prisma generate && next build`. The
  generate step matters — Vercel restores `node_modules` from cache between
  builds, and a cached Prisma client goes stale when the schema changes.
- Node version: the project builds on Node 22.
- The admin console at `/tg-admin` already sends `X-Robots-Tag: noindex`. That
  is not access control; see `docs/DECISIONS.md`.

## 4. OAuth redirect URIs

Each provider needs the deployed origin registered before sign-in works:

```
https://<your-domain>/api/auth/callback/google
https://<your-domain>/api/auth/callback/apple
```

Preview hostnames change per deployment, so social sign-in generally only works
against the production domain unless a stable preview alias is registered too.
