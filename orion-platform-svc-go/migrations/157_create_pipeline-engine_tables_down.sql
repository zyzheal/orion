-- Auto-generated rollback for version 157. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_tasks_created";

DROP INDEX IF EXISTS "idx_tasks_tenant";

DROP TABLE IF EXISTS "tasks" CASCADE;

DROP INDEX IF EXISTS "idx_stages_created";

DROP INDEX IF EXISTS "idx_stages_tenant";

DROP TABLE IF EXISTS "stages" CASCADE;

DROP INDEX IF EXISTS "idx_pipeline_runs_created";

DROP INDEX IF EXISTS "idx_pipeline_runs_tenant";
