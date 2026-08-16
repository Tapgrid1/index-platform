import { signIn } from '@/auth';

export default function MerchantLogin() {
  return (
    <main className="mx-auto max-w-[420px] px-6 py-20">
      <div className="eyebrow">Merchant portal</div>
      <h1 className="mb-6 mt-2 text-[32px] font-bold tracking-[-0.04em]">Sign in</h1>
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
    </main>
  );
}
