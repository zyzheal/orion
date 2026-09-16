-- Auto-generated rollback for version 045. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

-- Fixed: trigger + function cleanup (auto-generator had left CREATE body in down file)
DROP TRIGGER IF EXISTS trigger_update_hook_chains_updated_at ON hook_chains;
DROP FUNCTION IF EXISTS update_hook_chains_updated_at();

DROP INDEX IF EXISTS "idx_hook_chains_trigger";
DROP INDEX IF EXISTS "idx_hook_chains_tenant_id";
