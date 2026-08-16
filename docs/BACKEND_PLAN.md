# Backend plan

There is no separate backend service: "the backend" is Route Handlers, Server
Actions and Prisma over Postgres, inside the same Next.js app. This plan
closes the gaps in that layer. It supersedes the informal "what is
deliberately not built yet" list in `README.md` — each item there gets a
section here, sequenced, plus one gap that list missed.

Nothing below touches the data model. `prisma/schema.prisma` already carries
the columns and tables every item needs; this is exclusively about the
missing writers, jobs and integrations.

---

## P0 — outbound click logging doesn't exist

`README.md` and `ARCHITECTURE.md` §4 document `/out/s/:storeId` and
`/out/p/:productId` as live routes — enter-click and product-click loggers
that redirect and record a `ClickEvent`. They aren't in `src/app`. Only the
scan resolver (`src/app/r/[code]/route.ts`) writes events today.

This is worse than an unbuilt feature: `Store.enterClickCount`,
`Product.clickCount`, and the CTR already rendered on `/merchant/analytics`
and the cold-start count on `/tg-admin` are live UI reading columns that no
code path ever increments. Every merchant currently sees `0.0%` CTR
regardless of real traffic. Fix this before anything else — it's a shipped
page telling merchants something false.

**Approach:** mirror the resolver's own pattern, since it already got the
hard part right.

- `src/app/out/s/[storeId]/route.ts`, `src/app/out/p/[productId]/route.ts`
- `force-dynamic`, redirect first, log after — never block the redirect on
  the write, same `void Promise.all([...]).catch(() => {})` shape.
- Unknown id: soft-fail to `/` (or the store page), never a 404 — same
  reasoning as the resolver's unrecognised-code handling, just lower stakes.
- Write `ClickEvent` and increment the denormalised counter in the same
  fire-and-forget batch. Counters stay a cache; `ClickEvent` stays the
  source of truth for trend questions, per `ARCHITECTURE.md` §6.
- Product route additionally needs `destinationUrl` fetched by id before
  redirecting (single indexed lookup, same cost as the resolver's).

Effort: half a day. No dependencies. Do this first.

---

## P1 — rate limiting

Reports, comments and search are open to any authenticated shopper today
with no throttling. This is the cheapest item on the list and the one where
the cost of waiting compounds — every day live without it is a day of
exposure on a public registration flow.

**Approach:** a fixed-window or token-bucket limiter keyed on `userId`
(anonymous search on IP is explicitly out — `SearchLog` carries no IP by
design, so don't introduce one just for throttling; rate-limit anonymous
search by session cookie instead). Start in-process (`Map` with TTL sweep)
since this is a single Next.js deployment; move to Redis only if it scales
to multiple instances. Wrap the three action entry points
(`community.ts` report/comment, `shopper.ts` search) — not middleware,
since the limit differs per action and the actions already own validation.

Effort: 1–2 days.

---

## P2 — impression counting

`Store.impressionCount` exists and is read (merchant analytics, admin cold
start) but nothing increments it. Unlike clicks, a naive per-render
increment is actively wrong — it counts bots, prefetches and re-renders, not
distinct shopper views.

**Approach:** client-side beacon fired once per store card that enters the
viewport (`IntersectionObserver`, `navigator.sendBeacon` to a
`POST /api/impressions` route), debounced per session so a scroll-past
doesn't double-count. Batch server-side: buffer beacons in-memory and flush
`updateMany`/raw `UPDATE ... SET impression_count = impression_count + n`
increments every few seconds rather than one write per beacon. Filter known
bot user agents at the route before counting. This is more machinery than
P0's clicks because impressions have no natural server-side choke point
(a click already redirects through a route handler; a view does not).

Effort: 2–3 days. Depends on nothing above but is naturally sequenced after
P0 since it's the same shape of problem with one more layer.

---

## P3 — image pipeline

Store logos and product images are stored as data URIs so the app runs with
no object storage configured. This doesn't survive real usage: data URIs
bloat `Store`/`Product` rows and every page that renders them, and nothing
strips EXIF (GPS-tagged phone photos from merchants are a real leak) or
enforces a minimum dimension.

**Approach:**
1. Object storage — S3-compatible (S3, R2, or whatever the deploy target's
   ecosystem favors; no strong reason to prefer one here, ask if there's a
   platform preference).
2. Presigned upload: a server action issues a short-lived presigned PUT URL
   scoped to the requesting owner's store; the client uploads directly,
   never through the Next.js server.
3. On upload-complete callback (or a poll), server-side re-encode to a fixed
   format (webp), strip EXIF, enforce a minimum-dimension gate, write the
   final object key to `Product.imageUrl` / `Store.logoUrl`.
4. Migration: existing seeded data URIs stay as-is (seed data isn't
   production merchant content); only new uploads go through the pipeline.

Effort: 3–4 days including the re-encode worker. Needs an object storage
credential decision before starting.

---

## P4 — email

Override notices render in-portal (`OverrideNotice` + the revert banner)
but the accompanying email is never sent. Same gap applies to verification
decisions (`GRANTED`/`DENIED`) and merchant password reset, which has no
path at all right now — a merchant who forgets their password is stuck,
since `Credentials` auth has no reset flow wired up.

**Approach:** one provider (Resend or Postmark are the low-friction choices
for a Next.js app; SES if cost at scale matters more than setup time — ask
if there's a preference), a thin `src/lib/email.ts` wrapper, and templates
for: override notice, verification decision, password reset. Trigger sends
from the existing action call sites (`admin.ts` override/verification
actions already have before/after and reason in hand) rather than a queue —
volume here is admin-action-driven, not user-driven, so synchronous send
inside the action is fine and simpler than standing up a job queue for it.

Effort: 2 days for the wrapper + 3 templates, plus the password-reset flow
(token table already covered by `VerificationToken`, unused today) at
another 1–2 days.

---

## P5 — Apple Sign-In

`AUTH_APPLE_SECRET` is a static string; Apple requires a signed JWT
(ES256, rotated at most every 6 months, signed with a key from the Apple
Developer portal). Isolated, well-documented, no design decisions.

**Approach:** a small script or `src/lib/appleSecret.ts` that mints the JWT
from `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` env vars,
regenerated on deploy or via a cron a few days before expiry.

Effort: half a day. Needs Apple Developer account credentials, which is a
business-side dependency, not an engineering one.

---

## P6 — payments

The largest item, and the one with the least that can start today: tier and
billing status are modelled (`Tier`, `BillingStatus`, `paymentCustomerId`)
but no processor is wired up, and — per `README.md` — **tier prices are
unset**. Pricing is a business decision that blocks the engineering work,
not the other way around.

**Approach once pricing exists**, in order:
1. Stripe (Checkout + Customer Portal — building custom billing UI here is
   pure risk for no product benefit at this stage).
2. Checkout session on trial-to-paid conversion; webhook handler
   (`checkout.session.completed`, `customer.subscription.updated`,
   `invoice.payment_failed`) updating `User.billingStatus`/`subscriptionTier`.
3. `PAST_DUE` handling: grace period before tier features gate off, matching
   the gating table in `ARCHITECTURE.md` §3 — never gate community or basic
   analytics regardless of billing state, only the paid-tier rows.
4. `trialEndsAt` cron sweep to flip `TRIALING` → `CANCELED` for
   never-converted trials.

Effort: 1 week once pricing is set, most of it webhook edge cases and
idempotency (Stripe webhooks retry; handlers must be safe to run twice).

---

## P7 — tests

CI runs typecheck, lint and build only. Given every server action is the
actual authorization boundary (`requireUser`/`requireAdmin`/`requireOwnStore`
in `src/lib/authz.ts`), the highest-value tests are not UI tests — they're:

1. **Authz boundary tests per action** — every exported function in
   `src/actions/*.ts`, asserting the right role/ownership check fires and
   the wrong actor gets rejected. This is the surface where a missed check
   is a real vulnerability, not a cosmetic bug.
2. **Resolver integration test** — `/r/:code` for known, unknown, and
   expired-window placements, since this is the one endpoint with a
   "no retry" cost of being wrong (`ARCHITECTURE.md` §9).
3. **The 150-char story cap and 5-slot product constraint** — regression
   tests pinned to the DB-level CHECKs in `prisma/sql/constraints.sql`, so a
   future migration that drops one fails CI instead of failing silently.

Vitest is the natural fit (fast, works with the existing TS config, no
Next-specific test runner needed for action/unit-level tests). Add
Playwright only if/when the resolver or checkout flow need an end-to-end
smoke test — not needed to start.

Effort: ongoing; budget 3–4 days for the authz suite alone since it's one
test file per action module, then fold new tests into each future PR rather
than treating this as a one-time backfill.

---

## Cross-cutting: account delete and export

`DECISIONS.md` flags this directly: social auth, search logs, browsing
history and coarse scan geo put this product in scope for real disclosure
obligations, and it's "cheap to do correctly now and expensive to retrofit
after the first request arrives." It isn't in the README gap list but
belongs in this plan for that reason.

**Approach:** a `requireUser`-gated action that (a) exports `User` +
`SavedStore` + `ViewHistory` + `SearchLog` + forum content as JSON, and
(b) deletes/anonymizes on request — cascade deletes already exist on most
tables via `onDelete: Cascade`; forum content should tombstone (existing
self-delete path) rather than cascade-delete, so threads with replies don't
disappear out from under other users. Sequence this alongside P1
(rate limiting) — both are "cheap now, expensive later" infrastructure
rather than user-facing features, and both are prerequisites for opening
registration to real traffic in good conscience.

Effort: 2 days.

---

## Sequencing

```
P0  outbound click logging        — do first, fixes a live correctness bug
P1  rate limiting                 ─┐  cheap, urgent, no dependencies
CC  account delete/export         ─┘  same shape — ship together
P2  impression counting           — same problem as P0, one layer harder
P3  image pipeline                — blocks real merchant onboarding at scale
P5  Apple Sign-In                 — isolated, do whenever credentials land
P4  email                         — needed before P6 (override/verification
                                     notices; password reset)
P6  payments                      — blocked on pricing decision, do last
P7  tests                         — start the authz suite in parallel with P1;
                                     don't treat as a phase-gated deliverable
```

This tracks the product build sequence in `ARCHITECTURE.md` §9
(catalogue → retention loops → the moat → merchandising/scale): P0–P2 and CC
harden the retention-loop and moat metrics that already ship; P3–P4 unblock
real merchant onboarding; P6 is explicitly the last phase there too.

## Decisions this plan doesn't resolve

- **Object storage provider** (P3) and **email provider** (P4) — no strong
  technical reason to prefer one option; pick based on where this deploys.
- **Tier pricing** — blocks all of P6, not just the Stripe integration.
- **D1 in `DECISIONS.md`** (who owns the resolver) doesn't block any item
  above, but it blocks turning `AdPlacement`/`ScanEvent` into a commercial
  contract with a physical-materials vendor. Settle it before P6 if
  placement billing (vs. subscription-tier billing) is in scope.
