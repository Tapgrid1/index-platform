import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The development sign-in provider accepts an email and no password. It is the
 * single most dangerous line in this codebase if it ever reaches production, so
 * the guard around it gets a test rather than a comment.
 *
 * src/auth.ts is re-imported per case because the gate is evaluated once at
 * module load — which is the behaviour under test.
 */
async function loadProviders(env: Record<string, string | undefined>) {
  vi.resetModules();

  // stubEnv rather than assignment: NODE_ENV is a non-writable property under
  // the test runner, and vitest restores stubs cleanly between cases.
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value as string);
  }

  const captured: { ids: string[] } = { ids: [] };

  vi.doMock('next-auth', () => ({
    default: (config: { providers: { id?: string; options?: { id?: string } }[] }) => {
      captured.ids = config.providers.map((p) => p?.id ?? p?.options?.id ?? 'unknown');
      return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
    },
  }));
  vi.doMock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));
  vi.doMock('@/lib/db', () => ({ db: {} }));
  vi.doMock('@/lib/appleSecret', () => ({ appleClientSecret: () => 'stub' }));
  vi.doMock('next-auth/providers/google', () => ({ default: { id: 'google' } }));
  vi.doMock('next-auth/providers/apple', () => ({ default: () => ({ id: 'apple' }) }));
  vi.doMock('next-auth/providers/credentials', () => ({
    default: (opts: { id?: string }) => ({ id: opts?.id ?? 'credentials' }),
  }));

  await import('./auth');
  return captured.ids;
}

describe('auth providers', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.doUnmock('next-auth');
    vi.unstubAllEnvs();
  });

  it('offers only OAuth providers by default', async () => {
    const ids = await loadProviders({ NODE_ENV: 'development', DEV_AUTH: undefined });
    expect(ids).toContain('google');
    expect(ids).toContain('apple');
    expect(ids).not.toContain('dev');
  });

  it('never registers the dev provider in production, even when DEV_AUTH is enabled', async () => {
    // The case that matters: a stray DEV_AUTH=enabled in a production
    // environment must not open a passwordless sign-in for every account.
    const ids = await loadProviders({ NODE_ENV: 'production', DEV_AUTH: 'enabled' });
    expect(ids).not.toContain('dev');
    expect(ids).toContain('google');
  });

  it('registers the dev provider only when both gates are open', async () => {
    const ids = await loadProviders({ NODE_ENV: 'development', DEV_AUTH: 'enabled' });
    expect(ids).toContain('dev');
  });

  it('ignores a truthy-but-wrong DEV_AUTH value', async () => {
    // Only the exact string opts in; "true"/"1" do not.
    for (const value of ['true', '1', 'yes', 'on']) {
      const ids = await loadProviders({ NODE_ENV: 'development', DEV_AUTH: value });
      expect(ids, `DEV_AUTH=${value}`).not.toContain('dev');
    }
  });

  it('exposes no password-based provider at all', async () => {
    const ids = await loadProviders({ NODE_ENV: 'production', DEV_AUTH: undefined });
    expect(ids).toEqual(['google', 'apple']);
  });
});
