import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInPanel } from '@/components/SignInPanel';
import { currentUser } from '@/lib/authz';

/**
 * Sign-in for everyone.
 *
 * The header used to send every signed-out visitor to /merchant/login, so a
 * shopper who wanted their archive back met a page headed "Merchant portal".
 * Same controls, shopper's framing.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await currentUser()) redirect('/');

  // Only same-origin paths. An open `next` is how a sign-in page becomes a
  // redirector to somebody else's site.
  const redirectTo = next && /^\/(?!\/)/.test(next) ? next : '/';

  return (
    <main className="mx-auto max-w-[420px] px-6 py-20">
      <Link href="/" className="mb-7 inline-flex h-8 items-center rounded-sm border border-line px-3 text-[12.5px]">
        ← Back to browsing
      </Link>

      <div className="eyebrow">Welcome back</div>
      <h1 className="mb-3 mt-2 text-[32px] font-bold tracking-[-0.04em]">Sign in.</h1>
      <p className="mb-7 text-[13.5px] text-ink-2">
        Browsing never needs an account. This is for your archive, the community,
        and your store if you have one.
      </p>

      <SignInPanel redirectTo={redirectTo} />

      <p className="mt-6 text-[12.5px] text-ink-3">
        No account yet?{' '}
        <Link href="/register" className="underline underline-offset-4">Create one</Link>.
      </p>
    </main>
  );
}
