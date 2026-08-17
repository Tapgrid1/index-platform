'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/authz';
import { isAdminEmail } from '@/lib/adminAllowlist';

/**
 * Step two of registration: intent.
 *
 * Auth comes first and intent second by design — the provider a person chose
 * is already a signal, so this arrives pre-selected rather than posed as a
 * blank question (see README). This action is what turns the answer into a
 * role, and it is the ONLY way an account becomes an OWNER.
 */
export async function chooseIntent(intent: 'shopping' | 'selling') {
  const user = await requireUser();

  if (intent === 'shopping') redirect('/');

  const current = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  });

  /**
   * Never demote. An admin picking "list my store" must not lose the console,
   * and an existing owner re-running this must not be reset. Note the allowlist
   * is authoritative for ADMIN either way — the jwt callback re-derives it on
   * every rotation, so writing OWNER over an allowlisted admin here would be
   * silently undone on the next request. Checking is clearer than relying on
   * that.
   */
  if (current?.role === 'SHOPPER' && !isAdminEmail(current.email)) {
    await db.user.update({ where: { id: user.id }, data: { role: 'OWNER' } });
  }

  revalidatePath('/merchant');
  redirect('/merchant/store');
}
