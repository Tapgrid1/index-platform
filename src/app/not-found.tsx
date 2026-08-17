import Link from 'next/link';

/**
 * 404.
 *
 * Also what a non-admin sees at /tg-admin: middleware rewrites there rather
 * than returning 403, so a prober gets no confirmation the path exists. That
 * makes this page part of the access-control story, and it must therefore stay
 * completely generic — any hint that some 404s are really "forbidden" undoes
 * the rewrite.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[520px] px-6 py-24">
      <div className="eyebrow">404</div>
      <h1 className="mb-3 mt-2.5 text-[38px] font-bold leading-[1.05] tracking-[-0.04em]">
        Nothing here.
      </h1>
      <p className="mb-7 text-ink-2">
        That page doesn’t exist, or it moved. The catalogue is the best place to start.
      </p>

      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-sm bg-ink px-4 text-[13.5px] font-medium text-white"
        >
          Browse the directory
        </Link>
        <Link
          href="/community"
          className="inline-flex h-10 items-center rounded-sm border border-line px-4 text-[13.5px]"
        >
          Community
        </Link>
      </div>
    </main>
  );
}
