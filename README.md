# the index — platform

An editorial directory of independent e-commerce stores, with a phygital scan
resolver underneath it.

Three audiences, one codebase:

- **Shoppers** browse a curated catalogue and keep an archive of what they find.
- **Store owners** manage a Store Card that links straight out to their own storefront.
- **Admins** run verification, moderation, forum structure, and support overrides.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Language | TypeScript, strict |
| Database | PostgreSQL via Prisma 6 |
| Auth | Auth.js v5 — Google/Apple or email + password, on both the shopper and merchant surfaces |
| Styling | Tailwind CSS |
| Validation | Zod at every mutation boundary |

## Getting started

```bash
cp .env.example .env          # fill in DATABASE_URL, AUTH_SECRET, ADMIN_PASSWORD
npm install
npx prisma migrate dev        # creates the schema
psql "$DATABASE_URL" -f prisma/sql/constraints.sql   # CHECK constraints Prisma can't express
npm run db:seed               # 8 stores, forum content, 2 scan placements
npm run dev
```

Generate a secret with `openssl rand -base64 32`.

| Surface | Path |
|---|---|
| Directory (public front door) | `/` |
| Community | `/community` |
| Shopper archive | `/archive` |
| Merchant portal | `/merchant` |
| Admin console | `/tg-admin` |
| Scan resolver | `/r/:code` |

---

## Architecture notes

Full detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); open questions in
[`docs/DECISIONS.md`](docs/DECISIONS.md). The points worth knowing before you
touch the code:

**Anyone can sign up, and anyone who signs up can list a store.** Registration
creates a real account — social through the provider, or email and password
through `registerWithPassword` — and `createStore` turns any signed-in account
into an owner with a published Store Card. Before this, `prisma/seed.ts` was the
only thing in the repository that could write a `User`, a `Store` or a
`Product`, which meant every tile in the directory was necessarily fictional.

**Middleware reads the session through `src/auth.config.ts`, never `src/auth.ts`.**
Middleware runs on the edge runtime and Prisma does not, so importing the full
config there made every `auth()` call throw and silently resolve to "signed
out" — the portal and the admin console were unreachable with any account. The
edge config only decodes the JWT; the fresh per-request read of role and status
stays in `src/lib/authz.ts`, which is where the guards that matter already live.

**The directory is the front door.** There is no gateway or role chooser in
front of the catalogue. Asking a visitor to classify themselves before they have
seen a single store is the highest-friction possible first screen for a product
whose central problem is getting shoppers to arrive. Registration asks for the
account first and intent second — and the auth method already predicts the
answer, so step two arrives pre-selected.

**Saved-store counts lead the merchant dashboard, not impressions.** Impressions
and outbound clicks will always lose an argument against a merchant's own
analytics, because the no-profile-intermediary design means we never hold the
session. Saved-store counts are first-party and unavailable in their dashboard,
which makes them the only retention metric they cannot contradict.

**Every outbound link leaves through a logger.** Enter goes to `/out/s/:storeId`
and product tiles to `/out/p/:productId`; those handlers are the only writers of
`enterClickCount` and `clickCount`. They redirect first and log after, never the
reverse — a shopper who clicked Enter is leaving, and analytics must not stand
in front of them.

**Redirect targets are allowlisted, not trusted.** `homeUrl`,
`destinationUrl` and `currentTargetUrl` are merchant- or admin-supplied strings
that end up in a `Location` header, so `src/lib/url.ts` gates all three to
http(s) and upgrades bare hosts to https. It runs at write time *and* at click
time: write-time rejection gives the merchant an error they can fix, click-time
rejection stops a row that predates the check from reaching a shopper.

**Impressions are earned, not rendered.** A card counts once it has held half
the viewport for half a second, once per store per session, reported by beacon
and coalesced server-side before it touches a counter. Incrementing per render
would count prefetches and bot crawls as shopper attention and put a write on
the read path of the busiest page in the product.

**Votes and likes are separate tables.** Votes rank content; likes signal
appreciation without touching rank. Collapsing them loses the ability to sort by
one and display the other.

**Deleting an account unwinds what it counted.** Cascades remove
`saved_stores` rows but leave `Store.savedCount` untouched, so a naive delete
drifts the merchant dashboard's headline metric upward forever. `src/lib/account.ts`
decrements the counters, reassigns forum authorship to a tombstone so other
people's replies survive, and only then deletes the row. Admins holding audit
rows cannot be deleted at all — that restriction is the point of the log.

**The audit log is append-only.** `src/lib/audit.ts` exposes `recordAudit()` and
deliberately no update or delete helper. Revoke `UPDATE`/`DELETE` on the table
from the application role in production — a rewritable record of admin actions
is worthless in exactly the situation you would need it.

**Overrides notify the merchant.** An admin editing a live storefront URL is the
highest-risk action in the product. A reason is mandatory, before/after is
captured, cross-domain repoints require a second confirmation, and the merchant
gets an in-portal banner with one-click revert.

**Thread URLs never encode the board slug.** Admins can move threads between
boards; a slug in the URL would break every existing link on each move.

**The portal gates on owning a store, not on holding a role.** `/merchant` is
guarded by `ownStoreOrOnboard()`, which sends an account with no store to
`/merchant/new` and an account with one back into the portal. The role in the
JWT cannot do that job: `createStore` promotes a shopper to owner, and the token
does not learn that until it rotates, so a role check in middleware would chase
the page's redirect in a loop. Server actions still use the throwing
`requireOwnStore()` — a 403 is the right answer to a POST, an onboarding form is
not.

**The unlisted admin path is not access control.** `/tg-admin` is a convenience.
An unguessable path leaks through referrers, history, proxy logs and
screenshots. The real controls are the role check in `src/middleware.ts` (which
rewrites to 404 rather than 403, so a prober gets no confirmation the path
exists), the `noindex` header, and — in deployment — a separate origin,
mandatory MFA and an IP allowlist.

**Five product slots are a database constraint.** `@@unique([storeId, sortOrder])`
plus a `CHECK (sort_order BETWEEN 0 AND 4)`. An application-layer check alone
drifts the moment another code path writes.

**The 150-character story cap is enforced three times** — `varchar(150)`, Zod,
and the form. Only the first one actually holds — and `npm run test:db` is what
proves it still does. This argument is only true while someone checks; the
five-slot CHECK made exactly the same claim and had silently never applied.

**A password reset must actually sign the attacker out.** Sessions are JWTs,
so there is no session row to delete. `User.sessionVersion` is stamped into the
token at sign-in and re-checked on every rotation; resetting a password bumps
it, and every older token fails the same status gate that suspensions use.
Without it, "reset your password" reassures the victim and inconveniences
nobody.

---

## What is deliberately not built yet

Honest list, so nobody mistakes scaffolding for a finished product:

- **Payments.** Tier and billing status are modelled; no processor is wired up. Tier prices are unset, which blocks the work rather than the reverse.
- **Image pipeline.** Uploads are stored as data URIs so the app runs with no object storage. Production needs presigned upload, server-side re-encode, EXIF strip, and a minimum-dimension gate. Blocked on choosing a storage provider.
- **Email delivery in production.** The sending seam, templates and call sites exist (`src/lib/email.ts`); with no `RESEND_API_KEY` set, messages are written to the server log instead of sent. Swapping in Postmark or SES means replacing one function.
- **Browser-level end-to-end tests.** 92 database-free tests cover authorization on every server action, account creation, the URL allowlist and the rate limiter; 22 more run against real Postgres in CI. Nothing drives an actual browser.

Sequenced plan for the above, with approaches and dependencies:
[`docs/BACKEND_PLAN.md`](docs/BACKEND_PLAN.md).

## Repository layout

```
prisma/
  schema.prisma        full data model, commented with the reasoning
  sql/constraints.sql  CHECK constraints Prisma cannot express
  seed.ts
src/
  actions/             server actions — every mutation, Zod-validated
    account.ts         self-service data export and account deletion
    admin.ts           override, verification, suspension, moderation, boards
    auth.ts            sign-up, password reset request + redemption
    community.ts       threads, comments, votes, likes, board prefs, reports
    merchant.ts        store card, products, routing, override revert
    shopper.ts         saves, view history, search logging
    authz.test.ts      authorization boundary suite — the guard on the guards
    auth.db.test.ts    reset flow against real Postgres
  app/
    page.tsx           the directory — public front door
    register/          account creation — social or email, then intent
    merchant/new/      first Store Card; outside the (portal) group by necessity
    r/[code]/          THE RESOLVER — physical scan entry point
    out/s|p/           outbound click loggers — the only writers of click counts
    api/impressions/   viewport-beacon ingest, buffered
    api/account/export account data download
    merchant/          merchant portal (login · forgot · reset are public)
    tg-admin/          admin console
  lib/
    account.ts         export + erasure, with counter unwinding
    appleSecret.ts     mints Apple's ES256 client-secret JWT
    audit.ts           append-only audit writer
    authz.ts           guards: requireUser / requireAdmin / requireOwnStore / hasTier
    clicks.ts          fire-and-forget click recording
    email.ts           send seam + templates (log driver when unconfigured)
    impressions.ts     buffered impression counter
    rateLimit.ts       fixed-window limiter
    url.ts             http(s) allowlist for every outbound redirect
  auth.config.ts       edge-safe half of the auth config — middleware uses this
  middleware.ts        route protection
```

## Verification

`npm run typecheck && npm run lint && npm test && npm run build` — all four
pass with no services running. `npm run test:db` additionally needs a Postgres
with the schema and `prisma/sql/constraints.sql` applied. CI runs all five on
every push and pull request (`.github/workflows/ci.yml`).

The suite is split on purpose. **`npm test`** (92 tests, no database) is
weighted toward authorization: server actions *are* the authorization boundary
here — middleware only guards page routes, so an action missing its guard is
reachable by anyone who can POST, whatever the UI shows.
`src/actions/authz.test.ts` asserts that every exported mutation refuses the
wrong actor, including cross-tenant cases (another merchant's override notice,
another store's placement) and the tier gate on routing.

**`npm run test:db`** (22 tests) covers what only a database can answer: that
the CHECK constraints are actually present, that the resolver never 404s for
any input, and that password reset stores its token hashed and single-use.
That suite earned its keep on the first run — it found that
`products_slot_range` had never applied, because the SQL referenced
`sort_order` while the column is `"sortOrder"`. The five-slot cap the README
described as a database guarantee was not being enforced by the database at
all.
