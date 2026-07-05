-- Rollback Migration 106_cross_domain
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: orchestration_workflows
DROP TABLE IF EXISTS orchestration_workflows CASCADE;

-- Dropping table: workflow_steps
DROP TABLE IF EXISTS workflow_steps CASCADE;

-- Dropping table: step_executions
DROP TABLE IF EXISTS step_executions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_workflow_;
DROP INDEX IF EXISTS CREATE INDEX idx_workflow_;
DROP INDEX IF EXISTS CREATE INDEX idx_workflow_;
DROP INDEX IF EXISTS CREATE INDEX idx_workflow_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
