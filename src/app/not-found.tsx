import Link from 'next/link';

/**
 * Also the page a prober gets for /tg-admin. src/middleware.ts rewrites an
 * unauthorised admin request here rather than answering 403, so this copy must
 * stay generic — it must not hint that the path it was reached from exists.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[520px] px-6 py-24">
      <div className="eyebrow">404</div>
      <h1 className="mb-4 mt-2.5 text-[34px] font-bold leading-[1.05] tracking-[-0.04em]">
        Nothing at this address.
      </h1>
      <p className="mb-7 text-ink-2">
        The link may be old, or the store behind it may have been unlisted. The
        directory is the place to pick the thread back up.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/"
          className="flex h-10 items-center rounded-sm bg-ink px-5 text-[13.5px] font-medium text-white"
        >
          Browse the directory
        </Link>
        <Link
          href="/community"
          className="flex h-10 items-center rounded-sm border border-line px-5 text-[13.5px] hover:border-ink"
        >
          Community
        </Link>
      </div>
    </main>
  );
}
