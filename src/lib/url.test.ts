import { describe, it, expect } from 'vitest';
import { safeExternalUrl } from './url';

/**
 * This function's output goes straight into a Location header, so the rejection
 * cases matter more than the acceptance cases.
 */
describe('safeExternalUrl', () => {
  it('upgrades a bare host to https', () => {
    // Merchants type this constantly and the schema does not stop them.
    expect(safeExternalUrl('acme.com')).toBe('https://acme.com/');
    expect(safeExternalUrl('  shop.acme.co.uk/store  ')).toBe('https://shop.acme.co.uk/store');
  });

  it('preserves an explicit scheme, path, query and port', () => {
    expect(safeExternalUrl('http://acme.com/a?b=c')).toBe('http://acme.com/a?b=c');
    expect(safeExternalUrl('https://acme.com:8443/x')).toBe('https://acme.com:8443/x');
  });

  it('rejects schemes that would be reflected back at a shopper', () => {
    // The reason the allowlist exists: these are all storable in homeUrl today.
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('does not let a hostile scheme survive by being prefixed', () => {
    // A naive implementation prepends https:// to anything without "://",
    // turning javascript:alert(1) into https://javascript:alert(1).
    // Rejected outright, rather than rescued into something https-shaped.
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('mailto:a@b.com')).toBeNull();
  });

  it('rejects a relative path rather than inventing a host from it', () => {
    // The bug this prevents: "/product/mug" becomes "https:///product/mug",
    // which parses as host "product". Every product tile in the seeded
    // catalogue redirected to https://product/<slug> because of this.
    expect(safeExternalUrl('/product/marbled-stone-mug')).toBeNull();
    expect(safeExternalUrl('product/marbled-stone-mug')).toBeNull();
    expect(safeExternalUrl('/')).toBeNull();
    expect(safeExternalUrl('checkout')).toBeNull();
  });

  it('rejects a host that could not resolve', () => {
    expect(safeExternalUrl('acme.')).toBeNull();
    expect(safeExternalUrl('.com')).toBeNull();
  });

  it('still allows localhost, for development and the resolver fallback', () => {
    expect(safeExternalUrl('http://localhost:3000/?scan=unrecognised')).toBe(
      'http://localhost:3000/?scan=unrecognised',
    );
  });

  it('rejects empty and unparseable input', () => {
    expect(safeExternalUrl('')).toBeNull();
    expect(safeExternalUrl('   ')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
    expect(safeExternalUrl('https://')).toBeNull();
  });
});
