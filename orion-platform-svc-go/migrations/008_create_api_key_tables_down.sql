-- Auto-generated rollback for version 008. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- Fixed: trigger + function cleanup (auto-generator had left CREATE body in down file)
DROP TRIGGER IF EXISTS trigger_update_api_keys_updated_at ON api_keys;
DROP FUNCTION IF EXISTS update_api_keys_updated_at();

DROP INDEX IF EXISTS "idx_api_keys_key_hash";
DROP INDEX IF EXISTS "idx_api_keys_user_id";
