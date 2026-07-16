-- Rollback Migration 043_create_plugin_executions
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: plugin_executions
DROP TABLE IF EXISTS plugin_executions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_plugin_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_plugin_execution;
