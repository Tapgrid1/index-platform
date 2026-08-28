import Link from 'next/link';
import { signIn } from '@/auth';

export default async function MerchantLogin({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;

  return (
    <main className="mx-auto max-w-[420px] px-6 py-20">
      <div className="eyebrow">Merchant portal</div>
      <h1 className="mb-6 mt-2 text-[32px] font-bold tracking-[-0.04em]">Sign in</h1>

      {reset && (
        <div className="mb-5 border border-line bg-wash p-3.5 text-[13px] text-ink-2">
          Password updated. Any other sessions on this account have been signed out.
        </div>
      )}

      <form
        action={async (formData: FormData) => {
          'use server';
          await signIn('credentials', {
            email: String(formData.get('email')),
            password: String(formData.get('password')),
            redirectTo: '/merchant',
          });
        }}
        className="space-y-4"
      >
        <input name="email" type="email" required placeholder="you@studio.com" className="w-full rounded-sm border border-line px-3 py-2.5" />
        <input name="password" type="password" required placeholder="••••••••••" className="w-full rounded-sm border border-line px-3 py-2.5" />
        <button className="h-11 w-full rounded-sm bg-ink text-[13.5px] font-medium text-white">Sign in</button>
      </form>

      <Link
        href="/merchant/forgot"
        className="mt-5 inline-block font-mono text-[11.5px] text-ink-3 underline"
      >
        Forgot your password?
      </Link>

      <div className="my-6 flex items-center gap-3 font-mono text-[10.5px] tracking-[0.1em] text-ink-4">
        <span className="h-px flex-1 bg-line" />OR<span className="h-px flex-1 bg-line" />
      </div>

      {/* Owners who signed up socially have no password to type. Offering only
          the credentials form here left them with no way in at all. */}
      <Provider provider="google" label="Continue with Google" />
      <Provider provider="apple" label="Continue with Apple" />

      <p className="mt-6 text-[12.5px] text-ink-3">
        No account yet? <Link href="/register?intent=sell" className="underline underline-offset-4">List your store</Link>.
      </p>
    </main>
  );
}

function Provider({ provider, label }: { provider: 'google' | 'apple'; label: string }) {
  return (
    <form
      action={async () => {
        'use server';
        await signIn(provider, { redirectTo: '/merchant' });
      }}
    >
      <button className="mb-2.5 h-11 w-full rounded-sm border border-line text-[13.5px] font-medium transition hover:border-ink hover:bg-wash">
        {label}
      </button>
    </form>
  );
}
