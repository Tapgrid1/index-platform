import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';

/** Thrown by the guards below; surfaced as a 403 by the calling route. */
export class Forbidden extends Error {
  constructor(msg = 'Forbidden') {
    super(msg);
    this.name = 'Forbidden';
  }
}

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.status !== 'ACTIVE') return null;
  return session.user;
}

/** Any signed-in, active account. Shoppers and owners are equal here — this is
 *  what backs forum parity: identical rights, differing only by badge. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Forbidden('Sign in required');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Forbidden('Admin only');
  return user;
}

/** Resolves the store the signed-in owner administers, or throws. */
export async function requireOwnStore() {
  const user = await requireUser();
  const store = await db.store.findUnique({ where: { ownerId: user.id } });
  if (!store) throw new Forbidden('No store on this account');
  return { user, store };
}

/**
 * Page and layout variant of requireOwnStore.
 *
 * Server actions must keep throwing: a 403 is the right answer to a POST from
 * an actor with no store. A *page* is different — an owner who has signed up
 * and not yet filled in a store card is not an error case, they are halfway
 * through onboarding, so send them to the form rather than to a stack trace.
 *
 * This distinction is why the merchant layout used to 500: it called the
 * throwing guard, and because a layout wraps every route beneath it, that took
 * /merchant/login down for exactly the signed-out merchants who needed it.
 */
export async function ownStoreOrOnboard() {
  const user = await currentUser();
  if (!user) redirect('/merchant/login');

  const store = await db.store.findUnique({ where: { ownerId: user.id } });
  if (!store) redirect('/merchant/new');

  return { user, store };
}

/** Tier gate. Never gate anything that builds liquidity — see docs/ARCHITECTURE.md §3. */
const RANK = { NONE: 0, T1: 1, T2: 2, T3: 3 } as const;
export function hasTier(actual: keyof typeof RANK, required: keyof typeof RANK) {
  return RANK[actual] >= RANK[required];
}
