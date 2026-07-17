-- Auto-generated rollback for version 110. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_chaos_experiments_created";

DROP INDEX IF EXISTS "idx_chaos_experiments_tenant";

DROP TABLE IF EXISTS "chaos_experiments" CASCADE;

DROP INDEX IF EXISTS "idx_experiment_logs_created";

DROP INDEX IF EXISTS "idx_experiment_logs_tenant";

DROP TABLE IF EXISTS "experiment_logs" CASCADE;

DROP INDEX IF EXISTS "idx_experiment_results_created";

DROP INDEX IF EXISTS "idx_experiment_results_tenant";
