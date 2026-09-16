-- Auto-generated rollback for version 058. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- Fixed: trigger + function cleanup (auto-generator had left CREATE body in down file)
DROP TRIGGER IF EXISTS trigger_update_permissions_updated_at ON permissions;
DROP FUNCTION IF EXISTS update_permissions_updated_at();

DROP INDEX IF EXISTS "idx_permissions_resource";
DROP INDEX IF EXISTS "idx_permissions_code";
DROP INDEX IF EXISTS "idx_permissions_tenant_id";
