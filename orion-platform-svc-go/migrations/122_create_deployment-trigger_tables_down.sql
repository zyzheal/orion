-- Auto-generated rollback for version 122. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_deployment_triggers_created";

DROP INDEX IF EXISTS "idx_deployment_triggers_tenant";
