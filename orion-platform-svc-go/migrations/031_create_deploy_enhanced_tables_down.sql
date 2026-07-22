-- Auto-generated rollback for version 031. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_emergency_deploys_deployment";

DROP INDEX IF EXISTS "idx_emergency_deploys_status";

DROP INDEX IF EXISTS "idx_emergency_deploys_tenant";

DROP INDEX IF EXISTS "idx_progressive_deploys_deployment";

DROP INDEX IF EXISTS "idx_progressive_deploys_status";

DROP INDEX IF EXISTS "idx_progressive_deploys_tenant";

DROP INDEX IF EXISTS "idx_deploy_windows_environment";

DROP INDEX IF EXISTS "idx_deploy_windows_type";

DROP INDEX IF EXISTS "idx_deploy_windows_status";

DROP INDEX IF EXISTS "idx_deploy_windows_tenant";

DROP TABLE IF EXISTS "emergency_deploys" CASCADE;

DROP TABLE IF EXISTS "progressive_deploys" CASCADE;
