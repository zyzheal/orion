-- Rollback Migration 005_create_pipeline_runs
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_runs
DROP TABLE IF EXISTS pipeline_runs CASCADE;

-- Dropping table: stage_executions
DROP TABLE IF EXISTS stage_executions CASCADE;

-- Dropping table: task_executions
DROP TABLE IF EXISTS task_executions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_run;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_run;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_run;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_run;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_ta;
DROP INDEX IF EXISTS CREATE INDEX idx_ta;
