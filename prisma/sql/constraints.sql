-- Structural constraints Prisma cannot express in schema.prisma.
-- Apply after `prisma migrate dev` (or paste into the generated migration).

-- Five product slots per store, enforced at the database.
-- Combined with @@unique([storeId, sortOrder]) this caps a store at 5 products
-- no matter which code path writes. An application-layer check alone drifts.
ALTER TABLE products
  ADD CONSTRAINT products_slot_range CHECK (sort_order >= 0 AND sort_order <= 4);

-- The 150-character story cap is already varchar(150), but reject whitespace-only.
ALTER TABLE stores
  ADD CONSTRAINT stores_story_not_blank CHECK (length(btrim(story)) > 0);

-- Votes are +1 / -1 only.
ALTER TABLE forum_votes
  ADD CONSTRAINT forum_votes_value CHECK (value IN (-1, 1));

-- Audit log is append-only: revoke UPDATE and DELETE from the application role.
-- Replace app_user with the role your DATABASE_URL connects as.
-- REVOKE UPDATE, DELETE ON admin_audit_log FROM app_user;
