-- Rollback migration 408: Drop pipeline_executions table
DROP TABLE IF EXISTS pipeline_executions CASCADE;
