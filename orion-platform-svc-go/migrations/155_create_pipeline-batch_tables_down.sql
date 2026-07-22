-- Auto-generated rollback for version 155. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_batch_runs_created";

DROP INDEX IF EXISTS "idx_batch_runs_tenant";

DROP TABLE IF EXISTS "batch_runs" CASCADE;

DROP INDEX IF EXISTS "idx_phase_groups_created";

DROP INDEX IF EXISTS "idx_phase_groups_tenant";
