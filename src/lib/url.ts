/**
 * Outbound URL normalisation.
 *
 * Every URL this module returns is fed straight into a Location header, so the
 * scheme allowlist is a security control, not tidiness: `homeUrl`,
 * `destinationUrl` and `currentTargetUrl` are all merchant- or admin-supplied
 * strings, and a stored `javascript:` value would otherwise be reflected back
 * to a shopper.
 *
 * Merchants routinely type "acme.com" rather than "https://acme.com", and the
 * schema does not force a scheme, so bare hosts are upgraded to https rather
 * than rejected — rejecting them turns a cosmetic input problem into a dead
 * Enter button.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // A bare host has no scheme. Anything with a scheme keeps it, so that a
  // hostile scheme is rejected below rather than silently prefixed into a
  // valid-looking https URL.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;

  /**
   * Reject anything whose "host" is not plausibly a host.
   *
   * Without this, the https upgrade above silently converts a relative path
   * into a redirect to a made-up domain: "/product/mug" becomes
   * "https:///product/mug", which the URL parser happily reads as host
   * "product", path "/mug". That is not a hypothetical — the seed wrote
   * destinationUrl as "/product/<slug>", and every product tile in the
   * catalogue resolved to https://product/<slug>.
   *
   * A real public host has a dot in it. localhost is allowed so development
   * and the resolver fallback keep working.
   */
  const host = url.hostname;
  if (host !== 'localhost' && !host.includes('.')) return null;
  // A trailing dot is legal DNS but never what a merchant meant to type.
  if (host.startsWith('.') || host.endsWith('.')) return null;

  return url.toString();
}
