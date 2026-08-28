# Supabase setup — index-platform

This run provisioned a Supabase project to host the `index-platform` Postgres database. **No secrets are stored in this document or committed to git.** The credentials live only in the operator's password manager under the project label **"Supabase / indes"**.

## The project

| Field | Value |
|---|---|
| Project name (display) | `indes` |
| Project ref | `grasaapfimbkevfuldlk` |
| Project URL | `https://grasaapfimbkevfuldlk.supabase.co` |
| Region | `us-east-1` (East US — North Virginia) |
| Tier | Free |
| Plan notes | Free tier carries 2-project cap, 500MB storage, 50k MAU row-level. Fine for staging; promote before any real launch. |
| Working org | `Tapgrid's projects` |

Note: the display name `indes` is a typo of `index`. The ref `grasaapfimbkevfuldlk` is the load-bearing identifier in connection strings and the dashboard URL — it cannot easily be renamed. Treat the ref as canonical and the display name as cosmetic.

## Credentials to fetch (and where)

| Variable | Where in dashboard | Notes |
|---|---|---|
| `SUPABASE_URL` | Every page top bar | Already public; safe to commit to public docs |
| `NEXT_PUBLIC_SUPABASE_URL` | Same | Use this name in Next.js client code |
| `SUPABASE_PUBLISHABLE_KEY` (a.k.a. anon) | Settings → API Keys → Publishable | New format: `sb_publishable_…`. Public-by-design; safe in browser code IF RLS is enabled. |
| `SUPABASE_SECRET_KEY` (a.k.a. service_role) | Settings → API Keys → Secret | New format: `sb_secret_…`. **Server-only**. Never set on `NEXT_PUBLIC_*`, never expose to client. Bypasses RLS — full DB owner privileges. |
| `DATABASE_URL` | Settings → Database → Connection string → Transaction pooler → Copy | Port `6543`. Append `?pgbouncer=true&connection_limit=1`. |
| `DIRECT_URL` | Settings → Database → Connection string → Direct → Copy | Port `5432`. Prisma `db push` and migrations only. |
| `SUPABASE_DB_PASSWORD` | The password generated at project create | Shown only once. Reset from Settings → Database → Reset database password if lost. |

The legacy JWT-style `anon` and `service_role` keys are no longer the canonical form — Supabase's 2026 refresh moved to the `sb_publishable_…` / `sb_secret_…` pair. Either works today; new code should use the new pair.

## Where each variable goes

Three runtime surfaces, three trust levels. The principle is: **don't put a higher-trust secret on a lower-trust surface than it needs**.

| Surface | Variables required | Trust level | Why |
|---|---|---|---|
| **Vercel — Production** | `DATABASE_URL`, `DIRECT_URL` (used by Vercel build cache for `prisma generate`), `AUTH_SECRET`, all `AUTH_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESOLVER_FALLBACK_URL`, `SUPABASE_URL`, **`SUPABASE_SECRET_KEY`** | Server-only env (no `NEXT_PUBLIC_*` prefix) | Vercel encrypts these at rest; only the production runtime decrypts them. |
| **Vercel — Preview** | Same as Production, but pointed at a **separate** preview Supabase project if available (Free tier cap means one project per ref — for now, branch PRs share the staging project). Variables identical otherwise. | Server-only | Preview URLs hit the same DB as main unless a project alias is added. |
| **GitHub Actions CI** | `DIRECT_URL` only (CI runs `prisma db push` against the direct connection; runtime tests use the same). `AUTH_SECRET` set to a CI-only mock value to satisfy Auth's check. No service_role, no Supabase keys. | CI secret | CI has no application code path, only schema push + Vitest DB tests. |
| **Never** | `SUPABASE_SECRET_KEY` to anything `NEXT_PUBLIC_*` | — | That key bypasses RLS; it'd be a public admin into the DB. |

Schema-level sanity (current `prisma/schema.prisma`):

- `provider = "postgresql"` (already correct for Supabase)
- Two connection slots — `url` (pooler) and `directUrl` (direct)
- The `?pgbouncer=true` query string is appended manually on `DATABASE_URL` because Prisma does not infer it.
- The schema already encodes why each separation exists in inline comments; do not remove the comments.

## How to wire the secrets from your password manager

For each runtime surface:

1. **Vercel → Project → Settings → Environment Variables**
   - New variable: paste `NAME = value`, choose Production / Preview / both.
   - Variables starting with `NEXT_PUBLIC_` are exposed to the browser bundle — do not place `SUPABASE_SECRET_KEY` here.
   - After entering all variables, redeploy once so the build picks them up.

2. **GitHub → Repo → Settings → Secrets and Variables → Actions**
   - New repository secret: paste `NAME = value`, scope to Actions + Workflows.
   - CI needs `DIRECT_URL` and a CI-only `AUTH_SECRET`. It does **not** need any `SUPABASE_SECRET_KEY`.

3. **Local development**
   - Copy `.env.example` to `.env`, fill in any non-secret values, then copy the secret material from your password manager.
   - Recommend a `.gitignore` entry that prevents accidental commit of `.env` (the repo already has one).

## Things still owed / open decisions

- **Storage bucket** — Supabase Storage is the obvious default now that the project exists, but the indexing-platform image pipeline (where `Product.imageUrl` writes to) hasn't been wired yet. Pick before uploading the first store image.
- **Row Level Security** — Prisma talks as the database owner today, so RLS is not blocking any current code path. If/when the platform exposes any client-side `supabase-js` reads, RLS plus policies become mandatory. Suppress until that work starts.
- **GitHub repo connect** — Supabase can mirror the schema from a GitHub branch and run migrations on push. The `index-platform` repo's main branch has no Supabase integration configured; this is optional and not gated by anything else.
- **Project name** — `indes` should probably be deleted and recreated as `index-platform-staging` once the Free-tier reset window opens. Free tier caps at 2 active projects so deletion is required before recreate.
- **Region** — `us-east-1` was picked automatically by Supabase; a West-Coast region (`us-west-2`) would shave a few ms off every Vercel → DB round-trip. Re-create on Free reset window if this matters.

## Verification checklist (next session)

The first time a CI run or a Vercel preview URL hits the new database, run these — in order — and confirm each passes before merging:

1. `prisma generate` — compiles against the local schema; verifies `DATABASE_URL` parses.
2. `prisma db push` (against `DIRECT_URL`) — applies schema; should report the same tables the repo's `prisma/seed.ts` references.
3. `npm run test:db` — runs the 22 Postgres-touching Vitest cases. Failure here usually points to a CHECK constraint mismatch or a missing enum value.
4. Browser smoke: register a new user, create a store, click Enter on the directory. The `/out/s/:id` redirect must hit Supabase with a logged click.

If any step fails, the problem is almost always one of: wrong port (5432 vs 6543), missing `?pgbouncer=true`, password typo, or `DIRECT_URL` and `DATABASE_URL` swapped. Pin the Supabase dashboard open during the first verification pass.

## Operator acknowledgement

Provisioned on: 2026-08-28 03:53 UTC
Browser session: closed after credential capture; keys not exfiltrated to the sandbox.
Secret storage: user's password manager only.
