-- Rollback Migration 036_create_cron_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: cron_jobs
DROP TABLE IF EXISTS cron_jobs CASCADE;

-- Dropping table: cron_executions
DROP TABLE IF EXISTS cron_executions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_cron_job;
DROP INDEX IF EXISTS CREATE INDEX idx_cron_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_cron_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_cron_execution;
