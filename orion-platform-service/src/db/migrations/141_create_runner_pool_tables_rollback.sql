-- Rollback Migration 141_create_runner_pool_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: runners
DROP TABLE IF EXISTS runners CASCADE;

-- Dropping table: runner_jobs
DROP TABLE IF EXISTS runner_jobs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_runner;
DROP INDEX IF EXISTS CREATE INDEX idx_runner;
DROP INDEX IF EXISTS CREATE INDEX idx_runner;
DROP INDEX IF EXISTS CREATE INDEX idx_runner;
DROP INDEX IF EXISTS CREATE INDEX idx_runner_job;
DROP INDEX IF EXISTS CREATE INDEX idx_runner_job;
DROP INDEX IF EXISTS CREATE INDEX idx_runner_job;
DROP INDEX IF EXISTS CREATE INDEX idx_runner_job;
