'use client';

import Link from 'next/link';

/**
 * What a shopper meets when a page throws.
 *
 * The digest is shown on purpose. Next.js replaces the real message with a
 * hashed id in production, so a tester who can read the digest back is the
 * difference between a greppable server log and "it broke". Without this file
 * they get the framework's bare page and nothing to quote.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-[520px] px-6 py-24">
      <div className="eyebrow">Something went wrong</div>
      <h1 className="mb-4 mt-2.5 text-[34px] font-bold leading-[1.05] tracking-[-0.04em]">
        That page didn’t load.
      </h1>
      <p className="mb-7 text-ink-2">
        The failure is on our side, not yours. Trying again is worth a shot — if it
        keeps happening, the reference below tells us exactly which one it was.
      </p>

      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={reset}
          className="h-10 rounded-sm bg-ink px-5 text-[13.5px] font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex h-10 items-center rounded-sm border border-line px-5 text-[13.5px] hover:border-ink"
        >
          Back to the directory
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 border-t border-line pt-4 font-mono text-[11px] text-ink-3">
          Reference <b className="text-ink">{error.digest}</b> — quote this if you report it.
        </p>
      )}
    </main>
  );
}
