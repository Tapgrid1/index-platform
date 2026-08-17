import { signIn } from '@/auth';

/**
 * The only way into this product.
 *
 * `redirectTo` is what makes one component serve three entry points: the
 * merchant portal, the admin console and registration all need the same two
 * buttons and differ only in where they land afterwards.
 */
export function OAuthButtons({ redirectTo = '/' }: { redirectTo?: string }) {
  return (
    <div className="space-y-2.5">
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo });
        }}
      >
        <button className="flex h-11 w-full items-center justify-center gap-2.5 rounded-sm border border-line text-[13.5px] font-medium transition hover:border-ink hover:bg-wash">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.08 3.57-5.15 3.57-8.87z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
            />
          </svg>
          Continue with Google
        </button>
      </form>

      <form
        action={async () => {
          'use server';
          await signIn('apple', { redirectTo });
        }}
      >
        <button className="flex h-11 w-full items-center justify-center gap-2.5 rounded-sm border border-line text-[13.5px] font-medium transition hover:border-ink hover:bg-wash">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M17.05 12.54c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.54.02-2.96.9-3.75 2.28-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.29 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 3 .72 1.24-.02 2.02-1.12 2.78-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.67zM14.79 5.1c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.68-1.09 1.77-.96 2.81 1.02.08 2.06-.52 2.69-1.28z" />
          </svg>
          Continue with Apple
        </button>
      </form>
    </div>
  );
}
