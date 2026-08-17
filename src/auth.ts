import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { appleClientSecret } from '@/lib/appleSecret';
import { isAdminEmail } from '@/lib/adminAllowlist';
import type { Role } from '@prisma/client';

/**
 * Authentication is OAuth only.
 *
 * There is no password anywhere in this product — no hash stored, no reset
 * flow, no credential-stuffing surface, and nothing for a leaked database dump
 * to contain. Shoppers, merchants and admins all sign in the same way; the only
 * difference is the role that comes out the other side.
 *
 * Admin is not a database flag someone can set. It is derived from
 * ADMIN_EMAILS on every token rotation (see the jwt callback), so the admin
 * console follows the deploy configuration rather than the users table.
 */

/**
 * DEVELOPMENT ONLY. Never reachable in production — see the guard below and
 * the test in src/auth.test.ts that asserts it.
 *
 * Without this, a contributor cannot sign in at all without registering an
 * OAuth client first, which makes `npm run dev` useless out of the box and
 * makes the merchant portal untestable locally. It accepts any seeded email
 * with no password check, which is exactly why it must never ship.
 *
 * Two independent gates, because one is a typo away from a public backdoor:
 * NODE_ENV must not be production, AND DEV_AUTH must be explicitly enabled.
 */
const devAuthEnabled = process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH === 'enabled';

const devProvider = Credentials({
  id: 'dev',
  name: 'Development sign-in',
  credentials: { email: {} },
  async authorize(raw) {
    if (!devAuthEnabled) return null;

    const email = typeof raw?.email === 'string' ? raw.email.trim().toLowerCase() : '';
    if (!email) return null;

    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return null;

    return { id: user.id, email: user.email, name: user.name, image: user.image };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  pages: { signIn: '/register' },
  providers: [
    Google,
    // Apple's client secret is a signed ES256 JWT that has to be minted, not
    // configured. Minted at module load and cached, so a process that lives
    // longer than the token's 150-day life must be redeployed.
    Apple({ clientSecret: appleClientSecret() }),
    ...(devAuthEnabled ? [devProvider] : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      if (token.uid) {
        // Re-read on each rotation so a suspension, a role change, or an
        // allowlist edit takes effect without waiting for the session to expire.
        const fresh = await db.user.findUnique({
          where: { id: token.uid as string },
          select: { role: true, status: true, email: true, sessionVersion: true },
        });

        if (!fresh) {
          // The account is gone. Defaulting to ACTIVE/SHOPPER would hand a
          // deleted user a working session for as long as their token lives,
          // and self-service deletion makes that reachable.
          token.role = 'SHOPPER';
          token.status = 'DELETED';
          return token;
        }

        // Freshly signed in: stamp the token with the version it was minted at.
        if (user?.id) token.sv = fresh.sessionVersion;

        /**
         * The allowlist is authoritative in BOTH directions. Being listed
         * grants ADMIN even if the row says otherwise; not being listed strips
         * it even if the row says ADMIN. That means a stolen database write
         * cannot mint an admin, and removing someone from the deploy config
         * actually removes them.
         */
        const allowlisted = isAdminEmail(fresh.email);
        const effectiveRole: Role = allowlisted
          ? 'ADMIN'
          : fresh.role === 'ADMIN'
            ? 'SHOPPER'
            : fresh.role;

        token.status = token.sv === fresh.sessionVersion ? fresh.status : 'REVOKED';
        token.role = effectiveRole;

        // Keep the row in step with the allowlist so admin listings and audit
        // joins do not disagree with what the session actually permits.
        if (fresh.role !== effectiveRole) {
          await db.user
            .update({ where: { id: token.uid as string }, data: { role: effectiveRole } })
            .catch(() => {});
        }
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
