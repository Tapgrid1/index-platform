import type { NextAuthConfig } from 'next-auth';
import type { Role } from '@prisma/client';

/**
 * The half of the auth config that can run on the edge.
 *
 * Middleware executes in the edge runtime, and Prisma Client cannot. The full
 * config in src/auth.ts carries the Prisma adapter and a `jwt` callback that
 * re-reads the user on every rotation, so importing it into middleware made
 * every `auth()` call there throw JWTSessionError — which reads as "no session"
 * and bounced every signed-in visitor out of /merchant, /tg-admin and /archive.
 * Nobody could reach the portal at all, with any account.
 *
 * So middleware gets this instance instead: no adapter, no providers, no
 * database. It only decodes the JWT that sign-in already stamped with role and
 * status. That is a coarse first gate and is meant to be — the fresh read still
 * happens in src/lib/authz.ts on every page and every server action, which is
 * where this codebase's real authorization boundary lives.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/register' },
  // Deliberately empty: sign-in itself is handled by the full config, and
  // Apple's provider mints an ES256 secret at module load that the edge
  // runtime cannot produce.
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.status = token.status as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
