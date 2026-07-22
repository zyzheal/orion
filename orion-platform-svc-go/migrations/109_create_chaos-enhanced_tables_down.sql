-- Auto-generated rollback for version 109. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_fault_injections_created";

DROP INDEX IF EXISTS "idx_fault_injections_tenant";

DROP TABLE IF EXISTS "fault_injections" CASCADE;

DROP INDEX IF EXISTS "idx_experiments_created";

DROP INDEX IF EXISTS "idx_experiments_tenant";
