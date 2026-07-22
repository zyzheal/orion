-- Rollback Migration 148_create_queue_jobs_table
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: queue_jobs
DROP TABLE IF EXISTS queue_jobs CASCADE;

DROP INDEX IF EXISTS idx_queue_job;
DROP INDEX IF EXISTS idx_queue_job;
DROP INDEX IF EXISTS idx_queue_job;
DROP INDEX IF EXISTS idx_queue_job;
