import NextAuth from 'next-auth';
import type { Role } from '@prisma/client';

/**
 * Edge-safe Auth.js instance, for middleware only.
 *
 * Middleware runs on the Edge runtime. The full config in src/auth.ts cannot:
 * its jwt callback queries Prisma, and Prisma Client throws on Edge
 * ("In order to run Prisma Client on edge runtime…"). Auth.js swallows that as
 * a JWTSessionError and returns null, so importing the full `auth` here does
 * not error visibly — it silently reports every signed-in user as signed out.
 *
 * The effect was total: owners bounced from /merchant back to /merchant/login
 * forever, /archive never opened, and /tg-admin returned 404 to actual admins.
 * It went unnoticed only because merchant sign-in was separately broken.
 *
 * This instance therefore does no database work at all. It only decrypts the
 * session cookie and reads the claims that the Node-side callback already
 * stamped into it. Freshness is unaffected in practice: the full callback
 * re-reads role and status on every rotation, and every page in this app is
 * server-rendered, so a suspension still takes effect on the user's next
 * request.
 *
 * Deliberately no providers. Verifying a cookie needs none, and registering
 * them here would put Apple's Node-crypto secret minting into the Edge bundle.
 */
export const { auth: edgeAuth } = NextAuth({
  session: { strategy: 'jwt' },
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
});
