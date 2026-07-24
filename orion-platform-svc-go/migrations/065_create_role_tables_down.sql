-- Auto-generated rollback for version 065. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- REVIEW: unknown or non-reversible statement:
--   RETURN NEW
-- REVIEW: unknown or non-reversible statement:
--   END
-- REVIEW: unknown or non-reversible statement:
--   $$ LANGUAGE plpgsql
-- REVIEW: unknown or non-reversible statement:
--   CREATE TRIGGER trigger_update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_roles_updated_at()

DROP INDEX IF EXISTS "idx_roles_status";
