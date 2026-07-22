-- Auto-generated rollback for version 158. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_runs_created";

DROP INDEX IF EXISTS "idx_runs_tenant";

DROP TABLE IF EXISTS "runs" CASCADE;

DROP INDEX IF EXISTS "idx_checkpoints_created";

DROP INDEX IF EXISTS "idx_checkpoints_tenant";

DROP TABLE IF EXISTS "checkpoints" CASCADE;

DROP INDEX IF EXISTS "idx_execution_control_logs_created";

DROP INDEX IF EXISTS "idx_execution_control_logs_tenant";
