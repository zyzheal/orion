-- Auto-generated rollback for version 008. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- REVIEW: unknown or non-reversible statement:
--   RETURN NEW
-- REVIEW: unknown or non-reversible statement:
--   END
-- REVIEW: unknown or non-reversible statement:
--   $$ LANGUAGE plpgsql
-- REVIEW: unknown or non-reversible statement:
--   CREATE TRIGGER trigger_update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at()

DROP INDEX IF EXISTS "idx_api_keys_key_hash";

DROP INDEX IF EXISTS "idx_api_keys_user_id";
