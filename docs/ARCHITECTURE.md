# Architecture

Companion to the code. Section numbers match the comments in `prisma/schema.prisma`
and the server actions.

## §3 Tier gating

Guiding rule: **never gate anything that increases shopper-side supply or
liquidity.** Gate the things that give one merchant an advantage over another.

| Capability | Free trial | T1 | T2 | T3 |
|---|:--:|:--:|:--:|:--:|
| Store Card, 5-product carousel, Enter link | ✓ | ✓ | ✓ | ✓ |
| Community — full read/write/vote/like/comment | ✓ | ✓ | ✓ | ✓ |
| Live Preview + Edit Store Card | ✓ | ✓ | ✓ | ✓ |
| Basic analytics (saves, impressions, clicks) | ✓ | ✓ | ✓ | ✓ |
| Verified Maker badge | — | manual grant at any tier | | |
| Secondary tags, priority placement, leaderboards | — | — | ✓ | ✓ |
| Advanced analytics (search terms) | — | — | ✓ | ✓ |
| Physical placements + routing command center | — | — | — | ✓ |

Two deliberate choices: **basic analytics is free** (a merchant who sees nothing
for 30 days churns on day 31), and **the forum is free at every tier** (gating
participation starves the retention mechanism). **Verified Maker is not
tier-correlated** — a purchasable badge is not a trust signal.

## §4 Route map

```
PUBLIC
  /                          directory — the front door
  /collections/:slug         curated editorial collection
  /search?q=                 search (logs to search_log)
  /community                 forum
  /out/s/:storeId            enter-click logger → 302 to merchant
  /out/p/:productId          product deep-link logger → 302
  /r/:code                   RESOLVER — physical scan entry point
  /register                  two-step: account, then intent

SHOPPER SESSION
  /archive                   saved stores · recent views · search log

MERCHANT (email + password)
  /merchant                  live preview
  /merchant/store            edit store card
  /merchant/products         5 slots — image, title, destination URL
  /merchant/analytics        saves-led metrics; search terms at T2
  /merchant/bridge           teaser below T3; routing command center at T3

ADMIN (unlisted path, role-checked in middleware)
  /tg-admin                  system health + cold-start watch
  /tg-admin/merchants        override switch, suspension
  /tg-admin/verification     manual badge grant queue
  /tg-admin/community        boards + thread index (proactive)
  /tg-admin/moderation       report queue (reactive)
  /tg-admin/audit-log        append-only record
```

## §5 Permission matrix

| Action | Anon | Shopper | Owner | Admin |
|---|:--:|:--:|:--:|:--:|
| Browse, search, click out | ✓ | ✓ | ✓ | ✓ |
| Read forum | ✓ | ✓ | ✓ | ✓ |
| Create thread / comment / vote / like / share card / report | — | ✓ | ✓ | ✓ |
| Quick-Save, archive | — | ✓ | ✓ | ✓ |
| Verified Maker badge displayed | — | — | if granted | — |
| Edit own store + products | — | — | ✓ | ✓ (override) |
| Re-route a placement | — | — | T3 | ✓ |
| Edit another merchant's record | — | — | — | ✓ logged |
| Grant/revoke badge, suspend, ban, moderate | — | — | — | ✓ logged |
| Read audit log | — | — | — | ✓ read-only |

Forum parity is the load-bearing row set: shoppers and owners call the same
server actions with the same rights. The badge is a display concern only.

Implementation notes that are easy to get wrong:
- **Owners are also shoppers.** One `users` table with a role flag, not two
  account types — otherwise owners cannot bookmark peers.
- **Self-delete and admin-delete are different operations.** Self-delete
  tombstones; admin delete preserves the original text for the audit row.
- **Nobody can edit the audit log**, including admins.

## §6 Data model

See `prisma/schema.prisma` — every table is commented with its reasoning. The
ones people get wrong:

- `saved_stores` — the strongest first-party signal; leads the merchant dashboard.
- `search_log` — anonymous rows carry **no IP and no device fingerprint**.
- `click_events` — raw events are the source of truth; the counters on `stores`
  and `products` are a cache. Trend questions cannot be answered from counters.
- `forum_votes` vs `forum_likes` — separate on purpose.
- `user_board_prefs` — per-user, so it can never be cached with the global board list.
- `placement_routes` — re-routing history; without it you cannot explain a
  scan-count change to a merchant who has re-pointed three times.
- `admin_audit_log` — append-only, enforced at the database.

## §7 The override contract

1. Reason mandatory, stored on the audit row.
2. Before/after captured.
3. Merchant notified in-portal with one-click revert.
4. Cross-domain repoint requires a second confirmation — otherwise it is
   indistinguishable from an attack.

## §8 Where attribution ends

The no-profile-intermediary design means the merchant owns the session the
moment a shopper clicks Enter. Their analytics can always contradict ours. This
is why the dashboard leads with saved-store counts: first-party, and impossible
for them to replicate or dispute.

## §9 Build sequencing

1. Catalogue exists and looks excellent — plus hand-seeded stores.
2. Retention loops — accounts, saves, archive, forum, verification.
3. **The moat** — resolver, placements, routing, scan analytics.
4. Merchandising and scale — collections, tags, leaderboards, tier enforcement.

Deliberately deferred: live real-time traffic dashboards. Satisfying to build,
rarely decision-informing before meaningful scale.
