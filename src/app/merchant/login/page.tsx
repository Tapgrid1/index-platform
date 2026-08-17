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
    </main>
  );
}
