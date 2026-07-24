-- Auto-generated rollback for version 103. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_cache_cleanups_created";

DROP INDEX IF EXISTS "idx_cache_cleanups_tenant";
