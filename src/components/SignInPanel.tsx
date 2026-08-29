import Link from 'next/link';
import { signIn } from '@/auth';

/**
 * The sign-in controls, shared by /signin and /merchant/login.
 *
 * The two pages differ only in their copy and in where a successful sign-in
 * lands. Keeping one copy of the actual controls is what stops a provider being
 * added to one door and not the other — which is exactly how /merchant/login
 * ended up as the only credentials form in the product while shoppers were sent
 * to it under merchant branding.
 */
export function SignInPanel({ redirectTo }: { redirectTo: string }) {
  return (
    <>
      <form
        action={async (formData: FormData) => {
          'use server';
          await signIn('credentials', {
            email: String(formData.get('email')),
            password: String(formData.get('password')),
            redirectTo,
          });
        }}
        className="space-y-4"
      >
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@studio.com"
          className={INPUT}
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••••"
          className={INPUT}
        />
        <button className="h-11 w-full rounded-sm bg-ink text-[13.5px] font-medium text-white">
          Sign in
        </button>
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

      {/* Anyone who signed up socially has no password to type. */}
      <Provider provider="google" label="Continue with Google" redirectTo={redirectTo} />
      <Provider provider="apple" label="Continue with Apple" redirectTo={redirectTo} />
    </>
  );
}

const INPUT = 'w-full rounded-sm border border-line px-3 py-2.5 focus:border-ink focus:outline-none';

function Provider({
  provider,
  label,
  redirectTo,
}: {
  provider: 'google' | 'apple';
  label: string;
  redirectTo: string;
}) {
  return (
    <form
      action={async () => {
        'use server';
        await signIn(provider, { redirectTo });
      }}
    >
      <button className="mb-2.5 h-11 w-full rounded-sm border border-line text-[13.5px] font-medium transition hover:border-ink hover:bg-wash">
        {label}
      </button>
    </form>
  );
}
