-- Auto-generated rollback for version 077. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- Fixed: trigger + function cleanup (auto-generator had left CREATE body in down file)
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_users_updated_at();

DROP INDEX IF EXISTS "idx_users_email";
DROP INDEX IF EXISTS "idx_users_username";
DROP INDEX IF EXISTS "idx_users_tenant_id";
