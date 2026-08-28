'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { registerWithPassword } from '@/actions/auth';

/**
 * Email sign-up.
 *
 * The form this replaced was `<form action="/register">` with no method, so
 * submitting it performed a GET and put the typed password in the query string
 * — into browser history, the referrer header and any access log in front of
 * the app — while creating no account at all.
 */
export function RegisterForm({ intent }: { intent: 'shop' | 'sell' }) {
  const [f, setF] = useState({ email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg('');
        start(async () => {
          try {
            const { next } = await registerWithPassword({ ...f, intent });
            router.push(next);
            router.refresh();
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Could not create your account');
          }
        });
      }}
    >
      <Field label="Email">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@studio.com"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          className={input}
        />
      </Field>

      <Field label="Password · 12 characters minimum">
        <input
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          placeholder="••••••••••••"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          className={input}
        />
      </Field>

      <button
        disabled={pending}
        className="h-11 w-full rounded-sm bg-ink text-[13.5px] font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>

      {msg && <p className="font-mono text-[11.5px] text-red-600">{msg}</p>}
    </form>
  );
}

const input = 'w-full rounded-sm border border-line px-3 py-2.5 focus:border-ink focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">{label}</span>
      {children}
    </label>
  );
}
