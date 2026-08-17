# Backend plan

There is no separate backend service: "the backend" is Route Handlers, Server
Actions and Prisma over Postgres, inside the same Next.js app. This plan
closes the gaps in that layer. It supersedes the informal "what is
deliberately not built yet" list in `README.md` — each item there gets a
section here, sequenced, plus one gap that list missed.

Nothing below touches the data model. `prisma/schema.prisma` already carries
the columns and tables every item needs; this is exclusively about the
missing writers, jobs and integrations.

## Status

| | Item | State |
|---|---|---|
| P0 | Outbound click logging | **Shipped** |
| P1 | Rate limiting | **Shipped** |
| CC | Account export + deletion | **Shipped** |
| P2 | Impression counting | **Shipped** |
| P5 | Apple Sign-In client secret | **Shipped** |
| P4 | Email | **Shipped, log driver** — provider key and `/merchant/reset` page outstanding |
| P7 | Tests | **Shipped, boundary suite** — 80 tests; no DB-backed or e2e coverage |
| P3 | Image pipeline | Not started — blocked on storage provider |
| P6 | Payments | Not started — blocked on tier pricing |

Two things found during implementation that were not in the original plan and
are now fixed: the outbound routes were not merely unbuilt but **actively
linked from the UI** (see P0), and **no CI workflow existed at all** despite
`README.md` claiming one ran — `.github/workflows/ci.yml` now runs typecheck,
lint, test and build.

---

## P0 — outbound click logging doesn't exist ✅ shipped

`README.md` and `ARCHITECTURE.md` §4 document `/out/s/:storeId` and
`/out/p/:productId` as live routes — enter-click and product-click loggers
that redirect and record a `ClickEvent`. They weren't in `src/app`. Only the
scan resolver (`src/app/r/[code]/route.ts`) wrote events.

This was worse than an unbuilt feature, and worse than this plan first
recorded. `StoreCard.tsx` links Enter to `/out/s/:id` and `Carousel.tsx`
links every product tile to `/out/p/:id` — so those routes were not merely
missing, they were **linked from the UI on every card in the directory**.
Every Enter button and every product click returned a 404. The primary
conversion action of the product was broken, not just unmeasured; the dead
counters (`enterClickCount`, `clickCount`, the CTR on `/merchant/analytics`,
the cold-start count on `/tg-admin`) were the second-order symptom.

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

**As shipped**, plus three things the sketch above missed:

- Stored URLs are not trustworthy destinations. `homeUrl` and
  `destinationUrl` are free-text columns that land in a `Location` header, so
  `src/lib/url.ts` gates them to http(s) and upgrades bare hosts (merchants
  type `acme.com` constantly). The same helper now guards the resolver, the
  admin override, the store-card edit and placement re-routing — the resolver
  had the same exposure and no check.
- Suspended stores do not redirect. A suspended listing is unpublished
  everywhere else; sending traffic to it from a stale link would undo that.
- The product route falls back to the store's `homeUrl` before falling back
  to the directory. A broken product link still has a merchant behind it.

Attribution reads the session in parallel with the store lookup rather than
in series, so signed-in clicks are attributed without adding a round trip to
the path.

---

## P1 — rate limiting ✅ shipped

Reports, comments and search are open to any authenticated shopper today
with no throttling. This is the cheapest item on the list and the one where
the cost of waiting compounds — every day live without it is a day of
exposure on a public registration flow.

**Approach:** a fixed-window limiter keyed on `userId`, in-process (`Map`
with a sweep on write) since this is a single Next.js deployment; Redis only
once there is a second instance. Wired at the action entry points, not in
middleware, since the limit differs per action and the actions already own
validation.

**Deviation from the plan as written, deliberate.** The original text said to
key anonymous search on a session cookie and keep IP out of it entirely.
That does not work: an anonymous visitor has no session cookie, so it would
have left the actual abuse vector — unauthenticated search flooding —
unthrottled. Shipped instead: the client IP is hashed with a per-process
random salt and used only as an in-memory bucket key. It is never written to
a table, never logged, and dies with the process.

This does not violate the rule it appears to. That rule (§6) is about what
`search_log` *persists*; an ephemeral hash used to decide whether to accept a
write is a different thing, and leaving the log unthrottled is the larger
privacy risk, since an unthrottled log is the one that fills with scraped
queries. Flagged here because it contradicts the plan's own earlier
instruction and should be overruled deliberately if you disagree.

Search logging drops silently when limited rather than throwing — it is
called during the render of `/search`, and a scraper hitting the ceiling
should still get results; only the logging stops.

---

## P2 — impression counting ✅ shipped

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

**As shipped**, with one design point the sketch missed. `ImpressionTracker`
is mounted once in the root layout, and a root layout does not re-render on
client-side navigation — a one-shot `querySelectorAll` would have counted the
directory and then silently stopped counting the moment a shopper navigated
to a collection. It watches the DOM with a `MutationObserver` instead. The
obvious alternatives are both worse: `usePathname` misses `?q=` changes on
`/search`, and `useSearchParams` would opt the entire app out of static
rendering.

Threshold is half the card for half a second, deduped per store per session
in `sessionStorage`, batched and flushed on `pagehide`/`visibilitychange` so
a click through to a merchant does not lose the impression that preceded it.

The counter is soft and must stay that way: the ingest route is
unauthenticated (gating it on a session would count only signed-in shoppers,
who are not who the merchant is paying to reach), so bot-UA filtering and a
per-caller ceiling make casual inflation inconvenient without making the
number trustworthy. Nothing billable should ever be computed from it.

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

## P4 — email ✅ shipped (log driver; provider key outstanding)

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

**As shipped.** `src/lib/email.ts` has one `sendEmail()` with two drivers
behind it: Resend over `fetch` (no new dependency) when `RESEND_API_KEY` is
set, and a log driver otherwise. The log driver is what makes this mergeable
before the provider decision lands — dev and CI get a visible record of what
would have been sent and nothing disappears silently.

Sends are best-effort and never awaited into the caller's failure path. An
override must not roll back because a mail API had a bad minute, so the audit
row and the in-portal notice are written regardless.

Password reset (`src/actions/auth.ts`) closes a gap that was not in the
README's list at all: the credentials provider was the only way a merchant
signed in, and there was no reset path of any kind. Tokens are stored hashed
in `verification_tokens` under a `pwreset:` identifier prefix so they can
never be redeemed as an Auth.js sign-in token; one live token per account;
one hour; single use. The request endpoint always reports success, because
distinguishing "no such account" from "sent" makes it a membership oracle.

**Still outstanding:** a provider key, and the `/merchant/reset` page the
emailed link points at. The backend is complete; the link currently lands on
a route that does not exist.

---

## P5 — Apple Sign-In ✅ shipped

`AUTH_APPLE_SECRET` is a static string; Apple requires a signed JWT
(ES256, rotated at most every 6 months, signed with a key from the Apple
Developer portal). Isolated, well-documented, no design decisions.

**Approach:** a small script or `src/lib/appleSecret.ts` that mints the JWT
from `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` env vars,
regenerated on deploy or via a cron a few days before expiry.

**As shipped**, in `src/lib/appleSecret.ts`, with two traps worth recording:

- Node's ECDSA signing defaults to DER encoding; JWS requires the raw `r||s`
  pair. Without `dsaEncoding: 'ieee-p1363'` Apple rejects the assertion with
  an opaque `invalid_client`.
- The import must be `from 'crypto'`, not `from 'node:crypto'`.
  `src/middleware.ts` imports `@/auth`, which imports this file, so it lands
  in the Edge bundle — and webpack rejects the `node:` scheme there outright,
  failing the build. The file carries a comment saying so.

Missing credentials degrade to the previous static-string behaviour rather
than throwing, so an unconfigured Apple provider cannot take Google and the
credentials provider down with it. Still needs real Apple Developer
credentials, which is a business-side dependency.

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

## P7 — tests ✅ boundary suite shipped

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

**As shipped:** Vitest, 80 tests, no database required.

- `src/actions/authz.test.ts` — every exported mutation across all five
  action modules, asserted to refuse anonymous callers, suspended accounts,
  and (for admin actions) legitimate shoppers and owners. Plus the
  cross-tenant cases that a role check alone does not cover: another
  merchant's override notice, another store's placement, someone else's post.
  Plus the tier gate on routing, which is the one genuinely gated capability
  and therefore the one whose regression gives away the moat.
- `src/lib/url.test.ts` — the scheme allowlist, weighted to rejection cases,
  including the naive-implementation trap where `javascript:alert(1)` gets
  rescued into `https://javascript:alert(1)`.
- `src/lib/rateLimit.test.ts` — window exhaustion, reopening, and subject and
  rule isolation.

The suite asserts on refusal, not on happy paths: a broken happy path shows
up in any manual click-through, whereas a guard that stops guarding does not.
Adding a new action without adding it to the call list in that file is the
failure mode to watch for — the list is manual.

**Still outstanding:** nothing runs against a real database, so the DB-level
CHECK constraints in `prisma/sql/constraints.sql` (five product slots, the
150-character story cap, vote values) are still unverified by CI, and the
resolver's known/unknown/expired paths are covered only by reading. Both want
a Postgres service container in the workflow. Playwright remains unnecessary.

---

## Cross-cutting: account delete and export ✅ shipped

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
disappear out from under other users.

**As shipped**, in `src/lib/account.ts`. The hard part turned out not to be
deletion but deletion that does not corrupt everything around it — three
problems the cascades create:

1. **Cascades leave counters lying.** `saved_stores` cascades on user delete;
   `Store.savedCount` does not. A naive delete drifts the metric that leads
   the merchant dashboard upward permanently, on every account closure.
   Forum `score` and `likeCount` have the same problem via votes and likes.
   All three are unwound inside the transaction before the delete.
2. **Cascades destroy other people's conversations.** `ForumThread.author`
   and `ForumPost.author` both cascade, so a plain delete takes a thread and
   everyone's replies to it along with the departing account. Authorship is
   reassigned to a tombstone user — BANNED, no password hash, `.invalid`
   address, so it can never hold a session — and the body scrubbed.
3. **Admins with audit rows must not be deletable.** Already enforced by
   `onDelete: Restrict`; the action now surfaces it as an explanation rather
   than a constraint violation. Deleting the *who* must not dissolve the
   record of *what*.

Owners must confirm explicitly, since deletion takes the storefront, its
products and its placements with it. This is a real delete of the user row,
not an in-place anonymisation — anonymising is easier and is what most
implementations settle for, but it leaves a row that still joins to
everything the person did, which is not what someone asking to be deleted is
asking for. `search_log` is `SetNull`, so those rows survive as genuinely
anonymous, which is what that table is for.

Export is available both as a server action and as
`GET /api/account/export`, which sets `Content-Disposition` — an export a
user cannot actually save is not an export.

**Still outstanding:** no UI for either. Both are reachable only by calling
the action.

---

## Sequencing

```
P0  outbound click logging        ✅ done — fixed a live 404 on every card
P1  rate limiting                 ✅ done
CC  account delete/export         ✅ done
P2  impression counting           ✅ done
P5  Apple Sign-In                 ✅ done — awaiting Apple credentials
P4  email                         ✅ done — awaiting provider key + reset page
P7  tests                         ✅ boundary suite; DB-backed tests outstanding
P3  image pipeline                — next; blocked on storage provider choice
P6  payments                      — last; blocked on tier pricing
```

This tracks the product build sequence in `ARCHITECTURE.md` §9
(catalogue → retention loops → the moat → merchandising/scale): the shipped
items harden the retention-loop and moat metrics that already ship; P3 and
P4's provider key unblock real merchant onboarding; P6 is explicitly the last
phase there too.

## What to pick up next

1. **`/merchant/reset`** — the password-reset backend is complete and the
   emailed link currently lands on a 404. Smallest remaining gap between a
   working flow and a usable one.
2. **A Postgres service container in CI**, so the DB-level CHECK constraints
   and the resolver's expiry logic are actually verified rather than assumed.
3. **P3**, once a storage provider is chosen.
4. **Session revocation on password reset.** Documented inline in
   `src/actions/auth.ts`: adapter sessions are dropped, but the JWT strategy
   means an already-issued token stays valid until it rotates. Closing that
   properly needs a token version on the user row, checked in the `jwt`
   callback — worth doing before opening registration widely.

## Decisions this plan doesn't resolve

- **Object storage provider** (P3) and **email provider** (P4) — no strong
  technical reason to prefer one option; pick based on where this deploys.
- **Tier pricing** — blocks all of P6, not just the Stripe integration.
- **D1 in `DECISIONS.md`** (who owns the resolver) doesn't block any item
  above, but it blocks turning `AdPlacement`/`ScanEvent` into a commercial
  contract with a physical-materials vendor. Settle it before P6 if
  placement billing (vs. subscription-tier billing) is in scope.
