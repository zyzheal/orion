-- Auto-generated rollback for version 160. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_pipeline_templates_created";

DROP INDEX IF EXISTS "idx_pipeline_templates_tenant";
