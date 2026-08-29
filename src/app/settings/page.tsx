import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { DeleteAccount } from '@/components/DeleteAccount';
import { currentUser } from '@/lib/authz';
import { db } from '@/lib/db';

/**
 * The data-rights surface.
 *
 * Both halves of this already existed — collectAccountExport behind
 * /api/account/export, and deleteMyAccount in src/actions/account.ts — and
 * nothing in the application linked to either, so neither could be used. For a
 * beta collecting real accounts, "take your data and leave" has to be reachable
 * rather than merely implemented.
 */
export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/settings');

  const store = await db.store.findUnique({
    where: { ownerId: user.id },
    select: { id: true, name: true },
  });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[640px] px-6 py-14 md:px-10">
        <div className="eyebrow">Account</div>
        <h1 className="mb-2 mt-2 text-[34px] font-bold leading-[1.05] tracking-[-0.04em]">
          Settings
        </h1>
        <p className="mb-10 font-mono text-[11.5px] text-ink-3">
          {user.email} · {user.role.toLowerCase()}
        </p>

        <section className="mb-10 border-t border-line pt-6">
          <h2 className="mb-1.5 text-[16px] font-semibold tracking-[-0.02em]">Your data</h2>
          <p className="mb-4 text-[13.5px] leading-relaxed text-ink-2">
            Everything we hold about this account, as one JSON file: your saved
            stores, view and search history, forum posts, and — if you have one —
            your store card and its products.
          </p>
          <a
            href="/api/account/export"
            className="inline-flex h-10 items-center rounded-sm border border-line px-5 text-[13.5px] hover:border-ink"
          >
            Download my data
          </a>
        </section>

        {store && (
          <section className="mb-10 border-t border-line pt-6">
            <h2 className="mb-1.5 text-[16px] font-semibold tracking-[-0.02em]">Your store</h2>
            <p className="mb-4 text-[13.5px] leading-relaxed text-ink-2">
              You own <b>{store.name}</b>. Editing the card, its products and its
              routing all happen in the portal.
            </p>
            <Link
              href="/merchant"
              className="inline-flex h-10 items-center rounded-sm border border-line px-5 text-[13.5px] hover:border-ink"
            >
              Open the Merchant Portal
            </Link>
          </section>
        )}

        <section className="border-t border-line pt-6">
          <h2 className="mb-1.5 text-[16px] font-semibold tracking-[-0.02em]">
            Delete this account
          </h2>
          <p className="mb-4 text-[13.5px] leading-relaxed text-ink-2">
            Immediate and permanent. Download your data first if you want a copy.
          </p>
          <DeleteAccount ownsStore={!!store} />
        </section>
      </main>
    </>
  );
}
