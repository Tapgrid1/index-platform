import Link from 'next/link';
import { OAuthButtons } from '@/components/OAuthButtons';
import { DevSignIn } from '@/components/DevSignIn';

/**
 * Merchant sign-in. Identical mechanism to shopper sign-in — one account
 * system, one way in, and the role decides what you see afterwards.
 *
 * Note this page must stay OUTSIDE the (portal) route group. The layout in
 * there calls requireOwnStore(), which throws for anyone not yet signed in;
 * when this page lived under it, merchant sign-in returned a 500.
 */
export default async function MerchantLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-[420px] px-6 py-20">
      <div className="eyebrow">Merchant portal</div>
      <h1 className="mb-2 mt-2 text-[32px] font-bold tracking-[-0.04em]">Sign in</h1>
      <p className="mb-7 text-ink-2">
        The same account you browse with. There is no separate merchant password — and no password
        at all, which is why there is nothing here to forget or to leak.
      </p>

      {error && (
        <div className="mb-5 border border-line bg-wash p-3.5 text-[13px] text-ink-2">
          That sign-in didn’t complete. Try again.
        </div>
      )}

      <OAuthButtons redirectTo="/merchant" />
      <DevSignIn redirectTo="/merchant" />

      <p className="mt-7 border-t border-line pt-4 text-[13px] text-ink-3">
        Don’t have a store yet?{' '}
        <Link href="/register?intent=sell" className="underline underline-offset-4">
          Start one
        </Link>
        .
      </p>
    </main>
  );
}
