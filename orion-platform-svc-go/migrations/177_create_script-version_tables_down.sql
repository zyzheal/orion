-- Auto-generated rollback for version 177. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_script_versions_created";

DROP INDEX IF EXISTS "idx_script_versions_tenant";
