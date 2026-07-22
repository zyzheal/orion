-- Rollback Migration 137_add_environment_to_pipeline_runs
-- Auto-generated rollback script
-- Review carefully before executing in production

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_run;
