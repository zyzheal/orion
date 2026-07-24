-- Auto-generated rollback for version 014. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_backup_restores_status";

DROP INDEX IF EXISTS "idx_backup_restores_job";

DROP INDEX IF EXISTS "idx_backup_restores_tenant";

DROP INDEX IF EXISTS "idx_backup_storages_provider";

DROP INDEX IF EXISTS "idx_backup_storages_tenant";

DROP INDEX IF EXISTS "idx_backup_policies_tenant";

DROP INDEX IF EXISTS "idx_backup_jobs_status";

DROP INDEX IF EXISTS "idx_backup_jobs_tenant";

DROP TABLE IF EXISTS "backup_restores" CASCADE;

DROP TABLE IF EXISTS "backup_storages" CASCADE;

DROP TABLE IF EXISTS "backup_policies" CASCADE;
