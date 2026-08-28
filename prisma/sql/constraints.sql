-- Structural constraints Prisma cannot express in schema.prisma.
-- Apply after `prisma migrate dev` (or paste into the generated migration).
--
-- Every constraint is dropped before it is added, so this file can be applied
-- more than once — a second run used to fail outright on "constraint already
-- exists", which made re-running the database setup impossible. Apply it with
-- psql --single-transaction so the drop and the add land together and there is
-- never a moment when a live table is missing its check.

-- Five product slots per store, enforced at the database.
-- Combined with @@unique([storeId, sortOrder]) this caps a store at 5 products
-- no matter which code path writes. An application-layer check alone drifts.
--
-- The column identifier is quoted because schema.prisma maps TABLE names to
-- snake_case via @@map but leaves COLUMN names camelCase — there is no @map on
-- the field. Unquoted sort_order does not exist, and this statement silently
-- failed to apply for as long as it was written that way. src/lib/constraints.db.test.ts
-- exists so that cannot happen again unnoticed.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_slot_range;
ALTER TABLE products
  ADD CONSTRAINT products_slot_range CHECK ("sortOrder" >= 0 AND "sortOrder" <= 4);

-- The 150-character story cap is already varchar(150), but reject whitespace-only.
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_story_not_blank;
ALTER TABLE stores
  ADD CONSTRAINT stores_story_not_blank CHECK (length(btrim(story)) > 0);

-- Votes are +1 / -1 only.
ALTER TABLE forum_votes DROP CONSTRAINT IF EXISTS forum_votes_value;
ALTER TABLE forum_votes
  ADD CONSTRAINT forum_votes_value CHECK (value IN (-1, 1));

-- Audit log is append-only: revoke UPDATE and DELETE from the application role.
-- Replace app_user with the role your DATABASE_URL connects as.
-- REVOKE UPDATE, DELETE ON admin_audit_log FROM app_user;
