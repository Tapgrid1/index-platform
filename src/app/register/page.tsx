import Link from 'next/link';

/**
 * Two steps: capture the account, THEN ask intent.
 *
 * Intent is second on purpose — the auth method is already a strong signal, so
 * the second step arrives pre-selected rather than posed as a blank question.
 * Card capture lives on the seller branch only, which preserves the coupling
 * where the card requirement is what makes auto-publishing listings safe.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; via?: string; intent?: string }>;
}) {
  const { step = '1', via = 'google' } = await searchParams;

  if (step === '2') {
    const suggested = via === 'password' ? 'selling' : 'shopping';
    return (
      <main className="mx-auto max-w-[520px] px-6 py-20">
        <Link href="/register" className="mb-7 inline-flex h-8 items-center rounded-sm border border-line px-3 text-[12.5px]">
          ← Back
        </Link>
        <div className="eyebrow">Step 2 of 2 · <b className="text-accent">What brings you here?</b></div>
        <h1 className="mb-3 mt-2.5 text-[38px] font-bold leading-[1.05] tracking-[-0.04em]">Account created.</h1>
        <p className="mb-3.5 text-ink-2">You can do both later — this only decides what we show you first.</p>
        <div className="mb-6 font-mono text-[10.5px] tracking-wide text-ink-4">
          SIGNED UP VIA {via.toUpperCase()} · SUGGESTING “{suggested.toUpperCase()}”
        </div>

        <Choice href="/" title="I’m here to shop" suggested={suggested === 'shopping'}
          desc="Save stores, keep an archive, and post in the community with exactly the same rights as a maker." />
        <Choice href="/merchant" title="I’m here to list my store" suggested={suggested === 'selling'}
          desc="Opens the Merchant Portal. First month free — we take a card now, which is what makes auto-publishing listings safe."
          foot="card capture → auto-publish on submission" />
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

      <Choice href="/register?step=2&via=google" title="Continue with Google" desc="No password to store, and none to leak." />
      <Choice href="/register?step=2&via=apple" title="Continue with Apple" desc="Relay email supported." />

      <div className="my-5 flex items-center gap-3 font-mono text-[10.5px] tracking-[0.1em] text-ink-4">
        <span className="h-px flex-1 bg-line" />OR<span className="h-px flex-1 bg-line" />
      </div>

      <form action="/register" className="space-y-4">
        <input type="hidden" name="step" value="2" />
        <input type="hidden" name="via" value="password" />
        <Field label="Email" name="email" type="email" placeholder="you@studio.com" />
        <Field label="Password" name="password" type="password" placeholder="••••••••••" />
        <button className="h-11 w-full rounded-sm bg-ink text-[13.5px] font-medium text-white">Create account</button>
      </form>

      <p className="mt-6 border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-ink-3">
        The admin console lives at an unlisted path and is never surfaced here. An unguessable path is
        obfuscation, not access control — the real controls are the role check in middleware, a separate
        origin, mandatory MFA and an append-only audit log.
      </p>
    </main>
  );
}

function Choice({ href, title, desc, foot, suggested }: {
  href: string; title: string; desc: string; foot?: string; suggested?: boolean;
}) {
  return (
    <Link href={href} className={`mb-2.5 block border p-4.5 p-5 transition hover:border-ink hover:bg-wash ${suggested ? 'border-ink bg-wash' : 'border-line'}`}>
      <div className="mb-1 flex items-center gap-2 text-[14.5px] font-semibold">
        {title}
        {suggested && <span className="rounded-sm bg-ink px-1.5 py-[2px] font-mono text-[8.5px] uppercase tracking-wider text-white">Suggested</span>}
      </div>
      <div className="text-[12.5px] text-ink-3">{desc}</div>
      {foot && <div className="mt-2 font-mono text-[10px] text-ink-4">{foot}</div>}
    </Link>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">{label}</span>
      <input {...rest} className="w-full rounded-sm border border-line px-3 py-2.5 focus:border-ink focus:outline-none" />
    </label>
  );
}
