import { signIn } from '@/auth';

/**
 * Development-only sign-in. Renders nothing unless DEV_AUTH=enabled AND the
 * build is not production — the same double gate as the provider in
 * src/auth.ts, because a component that renders in production would be a
 * visible invitation to try the endpoint behind it.
 *
 * It exists so `npm run dev` works immediately after seeding, without a
 * contributor first registering a Google OAuth client. It takes an email and
 * no password.
 */
export function DevSignIn({ redirectTo = '/' }: { redirectTo?: string }) {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_AUTH !== 'enabled') return null;

  return (
    <div className="mt-6 border border-dashed border-line-2 bg-wash p-4">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
        Development sign-in · no password
      </div>
      <form
        action={async (formData: FormData) => {
          'use server';
          await signIn('dev', {
            email: String(formData.get('email') ?? ''),
            redirectTo,
          });
        }}
        className="flex gap-2"
      >
        <input
          name="email"
          type="email"
          required
          placeholder="seeded@example.com"
          className="h-9 flex-1 rounded-sm border border-line px-2.5 text-[13px] focus:border-ink focus:outline-none"
        />
        <button className="h-9 rounded-sm bg-ink px-3 text-[12.5px] font-medium text-white">
          Sign in
        </button>
      </form>
    </div>
  );
}
