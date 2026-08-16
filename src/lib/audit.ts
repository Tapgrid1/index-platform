import { db } from '@/lib/db';
import { headers } from 'next/headers';

type AuditInput = {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

/**
 * Append-only. There is intentionally no update() or delete() helper in this
 * module — if an admin can rewrite the record of admin actions, the record is
 * worthless in exactly the situation you would need it.
 *
 * Enforce it at the database too: see prisma/sql/constraints.sql.
 */
export async function recordAudit(input: AuditInput) {
  let ip: string | undefined;
  try {
    const h = await headers();
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  } catch {
    // headers() is unavailable outside a request scope (e.g. seeding).
  }

  return db.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeJson: (input.before ?? undefined) as never,
      afterJson: (input.after ?? undefined) as never,
      reason: input.reason,
      ip,
    },
  });
}
