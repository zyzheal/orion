-- Auto-generated rollback for version 200. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_version_archives_created";

DROP INDEX IF EXISTS "idx_version_archives_tenant";
