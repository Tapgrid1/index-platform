'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/authz';
import { enforce } from '@/lib/rateLimit';
import { collectAccountExport, deleteAccount } from '@/lib/account';
import { signOut } from '@/auth';

/**
 * Self-service data rights. Both actions are user-initiated and irreversible in
 * one direction, so both go through requireUser rather than trusting a passed
 * id — a delete endpoint that takes a user id from its caller is one bug away
 * from being an account-deletion API for everyone.
 */

export async function exportMyData() {
  const user = await requireUser();
  // Export is the most expensive read in the product (ten tables, unbounded
  // history), so it is throttled harder than anything else here.
  enforce('account.export', `u:${user.id}`);
  return collectAccountExport(user.id);
}

export async function deleteMyAccount(input: { confirmStoreDeletion?: boolean } = {}) {
  const user = await requireUser();
  await deleteAccount(user.id, { confirmStoreDeletion: input.confirmStoreDeletion });

  // The session outlives the row it points at unless it is explicitly ended;
  // the JWT callback would otherwise keep presenting a deleted account as
  // signed-in until the token happened to rotate.
  await signOut({ redirect: false });
  redirect('/?farewell=1');
}
