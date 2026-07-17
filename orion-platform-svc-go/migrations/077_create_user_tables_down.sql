-- Auto-generated rollback for version 077. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- REVIEW: unknown or non-reversible statement:
--   CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW()
-- REVIEW: unknown or non-reversible statement:
--   RETURN NEW
-- REVIEW: unknown or non-reversible statement:
--   END
-- REVIEW: unknown or non-reversible statement:
--   $$ LANGUAGE plpgsql
-- REVIEW: unknown or non-reversible statement:
--   CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at()

DROP INDEX IF EXISTS "idx_users_email";

DROP INDEX IF EXISTS "idx_users_username";

DROP INDEX IF EXISTS "idx_users_tenant_id";
