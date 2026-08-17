'use client';

import Link from 'next/link';

/**
 * Route-level error boundary.
 *
 * Without one of these, a throw from a server action or a page render shows
 * Next's unstyled default. Every guard in this codebase signals refusal by
 * throwing — Forbidden, RateLimited, "Not your placement" — so this page is
 * reached by ordinary refusals, not just genuine faults, and it should read
 * like the product rather than like a crash.
 *
 * It deliberately does NOT render error.message. In production Next already
 * redacts it to a digest, but this component also runs in development against
 * real messages, and building the habit of printing them is how internal
 * detail reaches a shopper.
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
      <h1 className="mb-3 mt-2.5 text-[38px] font-bold leading-[1.05] tracking-[-0.04em]">
        That didn’t work.
      </h1>
      <p className="mb-7 text-ink-2">
        The page couldn’t finish loading. This is usually temporary — try again, and if it keeps
        happening, the directory is still browsable from the front page.
      </p>

      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center rounded-sm bg-ink px-4 text-[13.5px] font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-sm border border-line px-4 text-[13.5px]"
        >
          Back to the directory
        </Link>
      </div>

      {error.digest && (
        // The one detail worth surfacing: it is the handle support needs to
        // find this exact failure in the logs, and it identifies nothing else.
        <p className="mt-8 border-t border-line pt-4 font-mono text-[11px] text-ink-4">
          Reference {error.digest}
        </p>
      )}
    </main>
  );
}
