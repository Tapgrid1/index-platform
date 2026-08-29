/**
 * Where an outbound click goes when there is nothing to send it to.
 *
 * Shared by both loggers so the two cannot drift, and resolved per request
 * rather than at module load: these routes are force-dynamic, and reading the
 * environment once at import time is how a value baked at build time ends up
 * outliving a redeploy.
 *
 * Mirrors the resolver's own fallback chain (src/app/r/[code]/route.ts).
 */
export function directoryUrl() {
  const base =
    process.env.RESOLVER_FALLBACK_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/`;
}
