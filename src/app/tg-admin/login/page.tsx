import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { currentUser } from '@/lib/authz';

/**
 * The admin console's own door.
 *
 * src/middleware.ts exempts exactly this path from the admin role check, and
 * until now no page existed at it, so the one route deliberately left open
 * answered 404. Adding it under the console layout would have been worse: that
 * layout calls requireAdmin() and wraps every route beneath it, which is the
 * same construction that made /merchant/login a 500 for signed-out merchants.
 * Hence the (console) route group — the guarded pages live inside it, this page
 * does not.
 *
 * The unlisted path is a convenience, not access control. The real controls are
 * the role check in middleware, the fresh re-read in requireAdmin(), the
 * noindex header, and — in deployment — a separate origin, MFA and an IP
 * allowlist.
 */
export default async function AdminLogin() {
  const user = await currentUser();
  if (user?.role === 'ADMIN') redirect('/tg-admin');

  return (
    <main className="grid min-h-screen place-items-center bg-admin-bg px-6 font-mono text-[12.5px] text-[#e4e7ec]">
      <div className="w-full max-w-[360px]">
        <div className="mb-1 text-[10px] tracking-[0.14em] text-[#5c6470]">
          /TG-ADMIN · INTERNAL
        </div>
        <h1 className="mb-7 font-sans text-2xl font-bold tracking-[-0.03em] text-white">
          Console sign-in
        </h1>

        <form
          action={async (formData: FormData) => {
            'use server';
            await signIn('credentials', {
              email: String(formData.get('email')),
              password: String(formData.get('password')),
              redirectTo: '/tg-admin',
            });
          }}
          className="space-y-3"
        >
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="admin@…"
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
          <button className="h-10 w-full rounded-sm bg-white text-[12.5px] font-bold text-admin-bg">
            Sign in
          </button>
        </form>

        <p className="mt-6 border-t border-admin-line pt-4 text-[10.5px] leading-relaxed text-[#5c6470]">
          Credentials only. Social sign-in never grants the admin role.
        </p>
      </div>
    </main>
  );
}

const INPUT =
  'w-full rounded-sm border border-admin-line bg-admin-panel px-3 py-2.5 text-[12.5px] text-white placeholder:text-[#5c6470] focus:border-[#5c6470] focus:outline-none';
