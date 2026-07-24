-- Auto-generated rollback for version 019. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_experiment_runs_experiment_id";

DROP INDEX IF EXISTS "idx_experiment_runs_tenant_id";

DROP TABLE IF EXISTS "experiment_runs" CASCADE;

DROP INDEX IF EXISTS "idx_experiments_status";

DROP INDEX IF EXISTS "idx_experiments_tenant_id";
