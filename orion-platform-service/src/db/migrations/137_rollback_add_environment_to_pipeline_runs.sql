-- Migration 137 Rollback: Remove environment support from pipeline_runs

ALTER TABLE pipeline_runs DROP CONSTRAINT IF EXISTS fk_pipeline_runs_environment;
ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS environment_name;
DROP INDEX IF EXISTS idx_pipeline_runs_env;
