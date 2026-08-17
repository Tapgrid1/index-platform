import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resetPassword } from '@/actions/auth';

/**
 * Redeem a reset link. This is where the emailed token lands.
 *
 * The token is carried in a hidden field rather than re-read from the URL on
 * submit, so a link that has been navigated away from cannot be replayed by
 * going back. Errors come back through the query string because this page is a
 * server component and the failure cases are all terminal — a bad token is not
 * something the user can correct in the form.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto max-w-[420px] px-6 py-20">
        <div className="eyebrow">Merchant portal</div>
        <h1 className="mb-4 mt-2 text-[32px] font-bold tracking-[-0.04em]">Link incomplete.</h1>
        <p className="mb-6 text-ink-2">
          That URL is missing its token. Request a fresh link and use the most recent email.
        </p>
        <Link href="/merchant/forgot" className="font-mono text-[11.5px] text-ink-3 underline">
          Request a new link →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[420px] px-6 py-20">
      <div className="eyebrow">Merchant portal</div>
      <h1 className="mb-2 mt-2 text-[32px] font-bold tracking-[-0.04em]">Choose a new password</h1>
      <p className="mb-6 text-ink-2">
        At least 12 characters. Setting it signs out everywhere else — which is the point, if
        someone else has been in this account.
      </p>

      {error && (
        <div className="mb-5 border border-line bg-wash p-3.5 text-[13px] text-ink-2">
          {decodeURIComponent(error)}
        </div>
      )}

      <form
        action={async (formData: FormData) => {
          'use server';
          try {
            await resetPassword({
              token: String(formData.get('token') ?? ''),
              password: String(formData.get('password') ?? ''),
            });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'That did not work. Request a new link.';
            redirect(
              `/merchant/reset?token=${encodeURIComponent(
                String(formData.get('token') ?? ''),
              )}&error=${encodeURIComponent(message)}`,
            );
          }
          redirect('/merchant/login?reset=1');
        }}
        className="space-y-4"
      >
        <input type="hidden" name="token" value={token} />
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          placeholder="••••••••••••"
          className="w-full rounded-sm border border-line px-3 py-2.5 focus:border-ink focus:outline-none"
        />
        <button className="h-11 w-full rounded-sm bg-ink text-[13.5px] font-medium text-white">
          Set new password
        </button>
      </form>
    </main>
  );
}
