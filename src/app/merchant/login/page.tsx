import Link from 'next/link';
import { SignInPanel } from '@/components/SignInPanel';

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

      <SignInPanel redirectTo="/merchant" />

      <p className="mt-6 text-[12.5px] text-ink-3">
        No account yet?{' '}
        <Link href="/register?intent=sell" className="underline underline-offset-4">
          List your store
        </Link>
        .
      </p>
    </main>
  );
}
