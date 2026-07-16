-- Rollback Migration 134_create_pipeline_triggers
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_triggers
DROP TABLE IF EXISTS pipeline_triggers CASCADE;

-- Dropping table: pipeline_trigger_executions
DROP TABLE IF EXISTS pipeline_trigger_executions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_trigger_execution;
