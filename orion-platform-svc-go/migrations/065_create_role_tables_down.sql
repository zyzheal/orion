-- Auto-generated rollback for version 065. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- Fixed: trigger + function cleanup (auto-generator had left CREATE body in down file)
DROP TRIGGER IF EXISTS trigger_update_roles_updated_at ON roles;
DROP FUNCTION IF EXISTS update_roles_updated_at();

DROP INDEX IF EXISTS "idx_roles_status";
