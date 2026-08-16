import Link from 'next/link';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/authz';

export async function Header({ activePill }: { activePill?: string }) {
  const [user, pills] = await Promise.all([
    currentUser(),
    db.collection.findMany({
      where: { kind: 'PILL', isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="flex h-16 items-center gap-7">
          <Link href="/" className="whitespace-nowrap text-[19px] font-extrabold tracking-[-0.045em]">
            the index<span className="font-medium text-ink-4">/</span>
          </Link>

          <form action="/search" className="relative hidden max-w-[460px] flex-1 md:block">
            <input
              name="q"
              placeholder="Search stores, materials, categories…"
              className="h-[38px] w-full rounded-sm border border-line bg-wash pl-9 pr-3 focus:border-ink focus:bg-white focus:outline-none"
            />
            <svg
              className="absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 opacity-35"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </form>

          <nav className="ml-auto flex items-center gap-2">
            <Link href="/community" className="flex h-9 items-center rounded-sm border border-line px-4 text-[13.5px] hover:border-ink">
              Community
            </Link>
            {user ? (
              <>
                <Link href="/archive" className="flex h-9 items-center rounded-sm border border-line px-4 text-[13.5px] hover:border-ink">
                  My Archive
                </Link>
                <Link
                  href={user.role === 'OWNER' ? '/merchant' : '/archive'}
                  className="flex h-9 items-center rounded-sm bg-ink px-4 text-[13.5px] font-medium text-white"
                >
                  {user.role === 'OWNER' ? 'Merchant Portal' : 'Account'}
                </Link>
              </>
            ) : (
              <>
                <Link href="/merchant/login" className="flex h-9 items-center rounded-sm border border-line px-4 text-[13.5px] hover:border-ink">
                  Sign in
                </Link>
                <Link href="/register" className="flex h-9 items-center rounded-sm bg-ink px-4 text-[13.5px] font-medium text-white">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Curated editorial collections, layered over the structural category
            taxonomy — two systems on purpose (docs/DECISIONS.md D4). */}
        <div className="flex gap-1 overflow-x-auto pb-3.5">
          <Pill href="/" label="All Stores" on={!activePill} />
          {pills.map((p) => (
            <Pill key={p.slug} href={`/collections/${p.slug}`} label={p.name} on={activePill === p.slug} />
          ))}
        </div>
      </div>
    </header>
  );
}

function Pill({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
        on ? 'border-ink bg-ink text-white' : 'border-line text-ink-2 hover:border-ink-3 hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );
}
