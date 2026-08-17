import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { GET } from './route';

/**
 * The resolver, against a real database.
 *
 * This is the one endpoint whose cost of being wrong is unrecoverable: it is hit
 * by someone standing in a physical location holding a phone, and a dead end on
 * printed material cannot be recalled (docs/DECISIONS.md D3). "Never a 404, for
 * any input" is the property worth pinning down, and it is exactly the kind of
 * property that a well-meaning refactor breaks.
 */

const suffix = Math.random().toString(36).slice(2, 10);
const codes = {
  live: `live-${suffix}`,
  future: `future-${suffix}`,
  past: `past-${suffix}`,
  unknown: `nope-${suffix}`,
  hostile: `hostile-${suffix}`,
};

const call = (code: string) =>
  GET(new Request(`http://localhost:3000/r/${code}`), { params: Promise.resolve({ code }) });

beforeAll(async () => {
  const day = 24 * 60 * 60 * 1000;

  await db.adPlacement.createMany({
    data: [
      { code: codes.live, currentTargetUrl: 'https://live.example.com/landing' },
      {
        code: codes.future,
        currentTargetUrl: 'https://future.example.com',
        activeFrom: new Date(Date.now() + day),
      },
      {
        code: codes.past,
        currentTargetUrl: 'https://past.example.com',
        activeTo: new Date(Date.now() - day),
      },
      // A value that predates the URL allowlist, or was written around it.
      { code: codes.hostile, currentTargetUrl: 'javascript:alert(1)' },
    ],
  });
});

afterAll(async () => {
  await db.adPlacement.deleteMany({ where: { code: { in: Object.values(codes) } } });
  await db.$disconnect();
});

describe('GET /r/:code', () => {
  it('redirects a live code to its target', async () => {
    const res = await call(codes.live);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://live.example.com/landing');
  });

  it('counts the scan and records the event', async () => {
    await call(codes.live);
    // The route logs without blocking the redirect, so the write lands just
    // after the response resolves.
    await new Promise((r) => setTimeout(r, 300));

    const placement = await db.adPlacement.findUnique({ where: { code: codes.live } });
    expect(placement!.scanCount).toBeGreaterThan(0);

    const events = await db.scanEvent.findMany({ where: { code: codes.live } });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].resolvedTargetUrl).toBe('https://live.example.com/landing');
  });

  it('sends an unknown code to the fallback, never a 404', async () => {
    const res = await call(codes.unknown);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('scan=unrecognised');
  });

  it('logs an unknown code so unrecognised scans are still measurable', async () => {
    await call(codes.unknown);
    await new Promise((r) => setTimeout(r, 300));

    const events = await db.scanEvent.findMany({ where: { code: codes.unknown } });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].placementId).toBeNull();

    await db.scanEvent.deleteMany({ where: { code: codes.unknown } });
  });

  it('sends a not-yet-active placement to the fallback', async () => {
    const res = await call(codes.future);
    expect(res.headers.get('location')).toContain('scan=unrecognised');
  });

  it('sends an expired placement to the fallback', async () => {
    const res = await call(codes.past);
    expect(res.headers.get('location')).toContain('scan=unrecognised');
  });

  it('refuses to reflect a non-http stored target', async () => {
    const res = await call(codes.hostile);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).not.toContain('javascript');
    expect(res.headers.get('location')).toContain('scan=unrecognised');
  });
});
