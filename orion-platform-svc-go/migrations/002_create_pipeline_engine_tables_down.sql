-- Auto-generated rollback for version 002. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.
DROP INDEX IF EXISTS "idx_pipeline_checkpoints_run_id";
DROP INDEX IF EXISTS "idx_pipeline_tasks_stage_id";
DROP INDEX IF EXISTS "idx_pipeline_stages_run_id";
DROP INDEX IF EXISTS "idx_pipeline_runs_tenant_id";
DROP INDEX IF EXISTS "idx_pipeline_runs_status";
DROP INDEX IF EXISTS "idx_pipeline_runs_pipeline_id";
DROP TABLE IF EXISTS "pipeline_checkpoints" CASCADE;
DROP TABLE IF EXISTS "pipeline_tasks" CASCADE;
DROP TABLE IF EXISTS "pipeline_stages" CASCADE;
DROP TABLE IF EXISTS "pipeline_runs" CASCADE;
