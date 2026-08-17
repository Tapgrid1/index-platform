import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Liveness + readiness for the deploy platform's health probe.
 *
 * It checks the database, because "the process is up" is not the useful
 * question — this app is unable to serve a single page without Postgres, so a
 * health check that only proves Node is running would keep a broken instance
 * in rotation.
 *
 * Deliberately returns no version, commit, environment or error detail: an
 * unauthenticated endpoint that reports what is deployed is free
 * reconnaissance. The status code carries everything a probe needs.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', db: 'ok', latencyMs: Date.now() - startedAt },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    // Logged server-side by Prisma; the response says only that it failed.
    return NextResponse.json(
      { status: 'degraded', db: 'unreachable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
