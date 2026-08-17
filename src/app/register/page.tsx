import Link from 'next/link';
import { currentUser } from '@/lib/authz';
import { OAuthButtons } from '@/components/OAuthButtons';
import { DevSignIn } from '@/components/DevSignIn';
import { chooseIntent } from '@/actions/register';

/**
 * Two steps: capture the account, THEN ask intent.
 *
 * Intent is second on purpose — the auth method is already a strong signal, so
 * the second step arrives pre-selected rather than posed as a blank question.
 *
 * Which step you see is now derived from whether you are actually signed in,
 * not from a query parameter. The previous version advanced on ?step=2 alone,
 * so the "account created" screen could be reached without creating one.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const user = await currentUser();

  if (user) {
    // The provider is the signal: someone arriving from the merchant call to
    // action is selling; everyone else is assumed to be shopping.
    const suggested = intent === 'sell' ? 'selling' : 'shopping';

    return (
      <main className="mx-auto max-w-[520px] px-6 py-20">
        <div className="eyebrow">
          Step 2 of 2 · <b className="text-accent">What brings you here?</b>
        </div>
        <h1 className="mb-3 mt-2.5 text-[38px] font-bold leading-[1.05] tracking-[-0.04em]">
          You’re signed in.
        </h1>
        <p className="mb-3.5 text-ink-2">
          You can do both later — this only decides what we show you first.
        </p>
        <div className="mb-6 font-mono text-[10.5px] tracking-wide text-ink-4">
          {user.email} · SUGGESTING “{suggested.toUpperCase()}”
        </div>

        <form
          action={async () => {
            'use server';
            await chooseIntent('shopping');
          }}
        >
          <IntentChoice
            title="I’m here to shop"
            desc="Save stores, keep an archive, and post in the community with exactly the same rights as a maker."
            suggested={suggested === 'shopping'}
          />
        </form>

        <form
          action={async () => {
            'use server';
            await chooseIntent('selling');
          }}
        >
          <IntentChoice
            title="I’m here to list my store"
            desc="Opens the Merchant Portal and your Store Card. Listings publish on submission."
            foot="auto-publish on submission · verification is a separate, manual badge"
            suggested={suggested === 'selling'}
          />
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[520px] px-6 py-20">
      <Link
        href="/"
        className="mb-7 inline-flex h-8 items-center rounded-sm border border-line px-3 text-[12.5px]"
      >
        ← Back to browsing
      </Link>
      <div className="eyebrow">
        Step 1 of 2 · <b className="text-accent">Create your account</b>
      </div>
      <h1 className="mb-3 mt-2.5 text-[38px] font-bold leading-[1.05] tracking-[-0.04em]">
        Join the index.
      </h1>
      <p className="mb-8 text-ink-2">
        Browsing never needs an account. This is for saving stores, joining the community, or
        listing a store of your own.
      </p>

      <OAuthButtons redirectTo={`/register${intent === 'sell' ? '?intent=sell' : ''}`} />
      <DevSignIn redirectTo={`/register${intent === 'sell' ? '?intent=sell' : ''}`} />

      <p className="mt-6 border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-ink-3">
        No passwords, anywhere. Sign-in is Google or Apple only, so this product stores no
        credential that could leak and offers nothing to guess. Admin access is granted by
        deploy configuration, never by a flag in the database.
      </p>
    </main>
  );
}

function IntentChoice({
  title,
  desc,
  foot,
  suggested,
}: {
  title: string;
  desc: string;
  foot?: string;
  suggested?: boolean;
}) {
  return (
    <button
      type="submit"
      className={`mb-2.5 block w-full border p-5 text-left transition hover:border-ink hover:bg-wash ${
        suggested ? 'border-ink bg-wash' : 'border-line'
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-[14.5px] font-semibold">
        {title}
        {suggested && (
          <span className="rounded-sm bg-ink px-1.5 py-[2px] font-mono text-[8.5px] uppercase tracking-wider text-white">
            Suggested
          </span>
        )}
      </div>
      <div className="text-[12.5px] text-ink-3">{desc}</div>
      {foot && <div className="mt-2 font-mono text-[10px] text-ink-4">{foot}</div>}
    </button>
  );
}
