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
| Auth | Auth.js v5 — Google/Apple for shoppers, credentials for merchants and admins |
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

**Votes and likes are separate tables.** Votes rank content; likes signal
appreciation without touching rank. Collapsing them loses the ability to sort by
one and display the other.

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
and the form. Only the first one actually holds.

---

## What is deliberately not built yet

Honest list, so nobody mistakes scaffolding for a finished product:

- **Payments.** Tier and billing status are modelled; no processor is wired up. Tier prices are unset.
- **Image pipeline.** Uploads are stored as data URIs so the app runs with no object storage. Production needs presigned upload, server-side re-encode, EXIF strip, and a minimum-dimension gate.
- **Email.** Override notices render in-portal; the accompanying email is not sent.
- **Impression counting.** The column exists and is read; nothing increments it yet (it needs a batched, bot-filtered writer — incrementing per render is both wrong and expensive).
- **Apple Sign-In** needs a real client secret (a signed JWT), not a static string.
- **Rate limiting** on reports, comments and search.
- **Tests.** CI runs typecheck, lint and build only.

## Repository layout

```
prisma/
  schema.prisma        full data model, commented with the reasoning
  sql/constraints.sql  CHECK constraints Prisma cannot express
  seed.ts
src/
  actions/             server actions — every mutation, Zod-validated
    admin.ts           override, verification, suspension, moderation, boards
    community.ts       threads, comments, votes, likes, board prefs, reports
    merchant.ts        store card, products, routing, override revert
    shopper.ts         saves, view history, search logging
  app/
    page.tsx           the directory — public front door
    r/[code]/          THE RESOLVER — physical scan entry point
    out/s|p/           outbound click loggers
    merchant/          merchant portal
    tg-admin/          admin console
  lib/
    audit.ts           append-only audit writer
    authz.ts           guards: requireUser / requireAdmin / requireOwnStore / hasTier
  middleware.ts        route protection
```

## Verification

`npm run typecheck && npm run lint && npm run build` — all three pass. CI runs
them on every push and pull request.
