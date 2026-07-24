-- Auto-generated rollback for version 134. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_health_checks_created";

DROP INDEX IF EXISTS "idx_health_checks_tenant";
