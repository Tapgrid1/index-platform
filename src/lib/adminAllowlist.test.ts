import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminEmail, adminEmails } from './adminAllowlist';

/**
 * The allowlist is the entire admin authorization model now that passwords are
 * gone, so its failure modes are worth pinning down precisely — particularly
 * the unset case, where the tempting-but-catastrophic reading of "no allowlist
 * configured" is "allow everyone".
 */
describe('admin allowlist', () => {
  const original = { emails: process.env.ADMIN_EMAILS, email: process.env.ADMIN_EMAIL };

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = original.emails;
    process.env.ADMIN_EMAIL = original.email;
  });

  it('grants nothing when unset', () => {
    // A missing environment variable must not be a full compromise of the
    // admin console.
    expect(isAdminEmail('anyone@example.com')).toBe(false);
    expect(adminEmails()).toEqual([]);
  });

  it('grants nothing when set to an empty or whitespace value', () => {
    process.env.ADMIN_EMAILS = '   ';
    expect(isAdminEmail('anyone@example.com')).toBe(false);

    process.env.ADMIN_EMAILS = ',,,';
    expect(isAdminEmail('anyone@example.com')).toBe(false);
  });

  it('matches a single configured address', () => {
    process.env.ADMIN_EMAILS = 'boss@index.test';
    expect(isAdminEmail('boss@index.test')).toBe(true);
    expect(isAdminEmail('someone@index.test')).toBe(false);
  });

  it('matches any address in a comma-separated list, ignoring spacing and case', () => {
    process.env.ADMIN_EMAILS = ' Boss@Index.test , second@index.test ';
    expect(isAdminEmail('boss@index.test')).toBe(true);
    expect(isAdminEmail('SECOND@INDEX.TEST')).toBe(true);
    expect(isAdminEmail(' second@index.test ')).toBe(true);
    expect(isAdminEmail('third@index.test')).toBe(false);
  });

  it('falls back to ADMIN_EMAIL so existing single-admin setups keep working', () => {
    process.env.ADMIN_EMAIL = 'legacy@index.test';
    expect(isAdminEmail('legacy@index.test')).toBe(true);
  });

  it('never matches a missing address', () => {
    process.env.ADMIN_EMAILS = 'boss@index.test';
    // Social providers can withhold an email; that must not become admin.
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
  });

  it('does not match a substring or a lookalike domain', () => {
    process.env.ADMIN_EMAILS = 'boss@index.test';
    expect(isAdminEmail('boss@index.test.evil.com')).toBe(false);
    expect(isAdminEmail('notboss@index.test')).toBe(false);
    expect(isAdminEmail('boss@index-test')).toBe(false);
  });
});
