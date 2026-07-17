-- Auto-generated rollback for version 101. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_build_environments_created";

DROP INDEX IF EXISTS "idx_build_environments_tenant";

DROP TABLE IF EXISTS "build_environments" CASCADE;

DROP INDEX IF EXISTS "idx_builds_created";

DROP INDEX IF EXISTS "idx_builds_tenant";
