import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requestPasswordReset } from '@/actions/auth';

/**
 * Request a reset link.
 *
 * The confirmation is identical whether or not the address exists — the action
 * behind it is deliberately incapable of telling the difference, and this page
 * must not reintroduce the distinction the action went to trouble to remove.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  if (sent) {
    return (
      <main className="mx-auto max-w-[420px] px-6 py-20">
        <div className="eyebrow">Merchant portal</div>
        <h1 className="mb-4 mt-2 text-[32px] font-bold tracking-[-0.04em]">Check your email.</h1>
        <p className="mb-6 text-ink-2">
          If that address has a password on it, a reset link is on its way. The link is valid for
          one hour and can be used once.
        </p>
        <Link href="/merchant/login" className="font-mono text-[11.5px] text-ink-3 underline">
          ← Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[420px] px-6 py-20">
      <div className="eyebrow">Merchant portal</div>
      <h1 className="mb-2 mt-2 text-[32px] font-bold tracking-[-0.04em]">Reset your password</h1>
      <p className="mb-6 text-ink-2">
        We’ll email you a link. Social accounts don’t have a password to reset — sign in with
        Google or Apple instead.
      </p>

      <form
        action={async (formData: FormData) => {
          'use server';
          await requestPasswordReset(String(formData.get('email') ?? ''));
          redirect('/merchant/forgot?sent=1');
        }}
        className="space-y-4"
      >
        <input
          name="email"
          type="email"
          required
          placeholder="you@studio.com"
          className="w-full rounded-sm border border-line px-3 py-2.5 focus:border-ink focus:outline-none"
        />
        <button className="h-11 w-full rounded-sm bg-ink text-[13.5px] font-medium text-white">
          Send reset link
        </button>
      </form>

      <Link
        href="/merchant/login"
        className="mt-6 inline-block font-mono text-[11.5px] text-ink-3 underline"
      >
        ← Back to sign in
      </Link>
    </main>
  );
}
