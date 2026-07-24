-- Auto-generated rollback for version 162. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_pipeline_versions_created";

DROP INDEX IF EXISTS "idx_pipeline_versions_tenant";
