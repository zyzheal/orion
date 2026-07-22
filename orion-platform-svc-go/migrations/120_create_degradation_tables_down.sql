-- Auto-generated rollback for version 120. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_degradations_created";

DROP INDEX IF EXISTS "idx_degradations_tenant";
