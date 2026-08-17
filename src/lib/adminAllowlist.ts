/**
 * Who is allowed to hold the ADMIN role.
 *
 * With passwords gone, admin access is "this Google/Apple account, and only
 * this one". The allowlist is configuration rather than data on purpose: an
 * admin flag that lives only in the users table can be granted by anything with
 * write access to that table, whereas this one requires a deploy.
 *
 * It is checked on every sign-in AND on every token rotation, so removing an
 * address from ADMIN_EMAILS demotes that account on its next request rather
 * than whenever someone remembers to edit the database.
 *
 * Kept free of Node built-ins: src/auth.ts imports it, and middleware bundles
 * src/auth.ts for the Edge runtime.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = adminEmails();
  // An empty allowlist grants nothing. The alternative — treating "unset" as
  // "allow everyone" — turns a missing environment variable into a full
  // compromise of the admin console.
  if (!list.length) return false;
  return list.includes(email.trim().toLowerCase());
}
