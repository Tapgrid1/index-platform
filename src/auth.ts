import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { appleClientSecret } from '@/lib/appleSecret';
import { hit, clientKeyFromHeaders } from '@/lib/rateLimit';
import type { Role } from '@prisma/client';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  pages: { signIn: '/register' },
  providers: [
    // Shopper path. Social only: no password to store, none to leak.
    Google,
    // Apple's client secret is a signed ES256 JWT that has to be minted, not
    // configured. Minted at module load and cached, so a process that lives
    // longer than the token's 150-day life must be redeployed — which is a far
    // safer failure mode than the static string this replaced, since that one
    // never worked at all.
    Apple({ clientSecret: appleClientSecret() }),
    // Merchant and admin path, against a separate credential store.
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();

        /**
         * Brute-force ceilings, checked before the password is compared.
         *
         * This is the only unauthenticated endpoint in the product that accepts
         * a guess and tells you whether it was right, and merchant accounts are
         * the ones with a storefront URL attached — the single highest-value
         * thing an attacker could repoint. Two ceilings because they catch
         * different attacks: one grinding a known account, one spraying a
         * common password across many.
         *
         * Every rejection below returns null identically. A limiter that says
         * "too many attempts" for real accounts and "invalid" for absent ones
         * is an account-existence oracle, which is most of what the attacker
         * wanted anyway.
         */
        const origin = clientKeyFromHeaders(new Headers(request?.headers));
        if (!hit('auth.signInOrigin', origin).ok) return null;
        if (!hit('auth.signInAccount', `e:${email}`).ok) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        // A banned or suspended account must not be able to obtain a session at all.
        if (user.status !== 'ACTIVE') return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      if (token.uid) {
        // Re-read on each rotation so a suspension or role change takes effect
        // without waiting for the session to expire.
        const fresh = await db.user.findUnique({
          where: { id: token.uid as string },
          select: { role: true, status: true, sessionVersion: true },
        });

        if (!fresh) {
          // The account is gone. Defaulting to ACTIVE/SHOPPER here — which is
          // what this did before — hands a deleted user a working session for
          // as long as their token lives, and self-service deletion makes that
          // reachable rather than theoretical.
          token.role = 'SHOPPER';
          token.status = 'DELETED';
          return token;
        }

        // Freshly signed in: stamp the token with the version it was minted at.
        if (user?.id) token.sv = fresh.sessionVersion;

        // Rotating an older token: a bumped version means the credentials it
        // was issued against are no longer valid. Marked rather than dropped so
        // it fails through the same status gate every guard already checks.
        token.status = token.sv === fresh.sessionVersion ? fresh.status : 'REVOKED';
        token.role = fresh.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.status = token.status as string;
      }
      return session;
    },
  },
});
