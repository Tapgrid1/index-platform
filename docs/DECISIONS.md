# Open decisions

Four calls that are not mine to make. Each shapes code that already exists, so
settling them early is cheaper than settling them later.

## D1 — Who owns the resolver? *(blocking)*

The admin console and the physical-materials supplier are both referred to as
"TapGrid" in the source brief, but this venture is standalone. Three possible
truths: it is a TapGrid property after all; it is standalone with TapGrid as a
**vendor** under a commercial arrangement; or the name is placeholder shorthand.

This matters well beyond branding: it determines **who owns the resolver
endpoint and the scan data**. If the supplier owns the resolver, this venture's
most defensible asset sits on another company's balance sheet and the directory
is left holding a commodity listing product. Decide before the resolver hardens
into a contract.

## D2 — Publish gate posture *(blocking)*

v0.2 auto-published listings on submission, using the card requirement as the
spam filter. v0.3 introduced manual Verified Maker approval. **Implemented as a
split:** listings auto-publish (`Store.status = PUBLISHED` on create), and the
badge is a manual grant. The badge then means something, and moderation cost
scales with badge applications rather than with every signup.

## D3 — Ship the resolver in v1, or the teaser?

The brief demotes the physical bridge to a locked tab. **This repo ships a
working thin resolver anyway** — `/r/:code`, a placement table, one editable
destination, route history, and scan logging. It is a few days of work and it
means the moat exists from day one and can be demonstrated to a venue partner.
Shipping the locked tab instead launches a commodity directory.

If you disagree, the resolver is cleanly isolated in `src/app/r/[code]/route.ts`
plus the placement models, and can be removed without touching anything else.

## D4 — Discovery pills vs. open taxonomy

**Implemented as both layers.** `Collection` rows are hand-curated editorial
groupings (a merchandising lever, and the natural home for paid placement
later). `Category` and `Tag` remain the structural taxonomy powering search and
filtering. Collapsing them into one system loses either editorial control or
filter granularity.

---

## Risks the code cannot solve

**Cold start is the real one.** Every feature here improves the experience of a
shopper who already arrived; none of them acquire one. Merchants churn on day 31
if the free month produced no traffic. Hand-seed 50–100 excellent stores before
launch: a directory with 100 curated stores and no paying merchants is a
*product*; one with 12 paying merchants and no traffic is neither.

**Manual verification cost is linear.** An hour a week at 20 signups; a hire at
500. Publish the criteria and consider auto-granting on objective signals
(domain age, storefront responding, complete card) with human review only at the
edges.

**Privacy surface is real.** Social auth, search logs, browsing history and
coarse scan geo put this in scope for genuine disclosure obligations. Cheap to
do correctly now — working delete-account and export paths — and expensive to
retrofit after the first request arrives.
