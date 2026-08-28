import Link from 'next/link';
import { signIn } from '@/auth';
import { currentUser } from '@/lib/authz';
import { RegisterForm } from '@/components/RegisterForm';

/**
 * Two steps: capture the account, THEN ask intent.
 *
 * Intent is second on purpose — the auth method is already a strong signal, so
 * the second step arrives pre-selected rather than posed as a blank question.
 *
 * Both steps are now real. Step 1 creates an account (social through the
 * provider, or email through registerWithPassword) and signs the person in;
 * step 2 is reached only once that has happened, so "Account created." is a
 * statement of fact rather than the placeholder it used to be.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; via?: string; intent?: string }>;
}) {
  const { step = '1', via = 'google', intent } = await searchParams;
  const wantsToSell = intent === 'sell';

  if (step === '2') {
    const user = await currentUser();
    const suggested = via === 'password' ? 'selling' : 'shopping';

    return (
      <main className="mx-auto max-w-[520px] px-6 py-20">
        <Link href="/register" className="mb-7 inline-flex h-8 items-center rounded-sm border border-line px-3 text-[12.5px]">
          ← Back
        </Link>
        <div className="eyebrow">Step 2 of 2 · <b className="text-accent">What brings you here?</b></div>
        <h1 className="mb-3 mt-2.5 text-[38px] font-bold leading-[1.05] tracking-[-0.04em]">
          {user ? 'Account created.' : 'Almost there.'}
        </h1>
        <p className="mb-3.5 text-ink-2">You can do both later — this only decides what we show you first.</p>
        <div className="mb-6 font-mono text-[10.5px] tracking-wide text-ink-4">
          SIGNED UP VIA {via.toUpperCase()} · SUGGESTING “{suggested.toUpperCase()}”
        </div>

        {/* Reaching step 2 without a session means the provider round trip did
            not complete. Saying so beats a dead choice that silently bounces
            off middleware. */}
        {!user && (
          <div className="mb-6 border border-line bg-wash p-3.5 text-[13px] text-ink-2">
            We could not confirm your sign-in. <Link href="/register" className="underline">Start again</Link>.
          </div>
        )}

        <Choice href="/" title="I’m here to shop" suggested={suggested === 'shopping'}
          desc="Save stores, keep an archive, and post in the community with exactly the same rights as a maker." />
        <Choice href="/merchant/new" title="I’m here to list my store" suggested={suggested === 'selling'}
          desc="Opens the Merchant Portal and starts your Store Card. Listings publish as soon as you submit them."
          foot="store card → auto-publish on submission" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[520px] px-6 py-20">
      <Link href="/" className="mb-7 inline-flex h-8 items-center rounded-sm border border-line px-3 text-[12.5px]">
        ← Back to browsing
      </Link>
      <div className="eyebrow">Step 1 of 2 · <b className="text-accent">Create your account</b></div>
      <h1 className="mb-3 mt-2.5 text-[38px] font-bold leading-[1.05] tracking-[-0.04em]">Join the index.</h1>
      <p className="mb-8 text-ink-2">
        Browsing never needs an account. This is for saving stores, joining the community, or listing a store of your own.
      </p>

      {wantsToSell && (
        <div className="mb-6 border border-line bg-wash p-3.5 text-[13px] text-ink-2">
          Listing a store starts with an account. You will be taken straight to your Store Card.
        </div>
      )}

      <Provider provider="google" label="Continue with Google" desc="No password to store, and none to leak." />
      <Provider provider="apple" label="Continue with Apple" desc="Relay email supported." />

      <div className="my-5 flex items-center gap-3 font-mono text-[10.5px] tracking-[0.1em] text-ink-4">
        <span className="h-px flex-1 bg-line" />OR<span className="h-px flex-1 bg-line" />
      </div>

      <RegisterForm intent={wantsToSell ? 'sell' : 'shop'} />

      <p className="mt-6 text-[12.5px] text-ink-3">
        Already have an account?{' '}
        <Link href="/merchant/login" className="underline underline-offset-4">Sign in</Link>.
      </p>

      <p className="mt-6 border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-ink-3">
        The admin console lives at an unlisted path and is never surfaced here. An unguessable path is
        obfuscation, not access control — the real controls are the role check in middleware, a separate
        origin, mandatory MFA and an append-only audit log.
      </p>
    </main>
  );
}

/**
 * One OAuth provider, as a real form post. These were `<Link>`s to a query
 * parameter, which is why no social account was ever created either.
 */
function Provider({ provider, label, desc }: { provider: 'google' | 'apple'; label: string; desc: string }) {
  return (
    <form
      action={async () => {
        'use server';
        await signIn(provider, { redirectTo: `/register?step=2&via=${provider}` });
      }}
    >
      <button className="mb-2.5 block w-full border border-line p-5 text-left transition hover:border-ink hover:bg-wash">
        <div className="mb-1 text-[14.5px] font-semibold">{label}</div>
        <div className="text-[12.5px] text-ink-3">{desc}</div>
      </button>
    </form>
  );
}

function Choice({ href, title, desc, foot, suggested }: {
  href: string; title: string; desc: string; foot?: string; suggested?: boolean;
}) {
  return (
    <Link href={href} className={`mb-2.5 block border p-5 transition hover:border-ink hover:bg-wash ${suggested ? 'border-ink bg-wash' : 'border-line'}`}>
      <div className="mb-1 flex items-center gap-2 text-[14.5px] font-semibold">
        {title}
        {suggested && <span className="rounded-sm bg-ink px-1.5 py-[2px] font-mono text-[8.5px] uppercase tracking-wider text-white">Suggested</span>}
      </div>
      <div className="text-[12.5px] text-ink-3">{desc}</div>
      {foot && <div className="mt-2 font-mono text-[10px] text-ink-4">{foot}</div>}
    </Link>
  );
}
