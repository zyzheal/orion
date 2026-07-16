-- Rollback Migration 133_create_pipeline_checkpoints_table
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_checkpoints
DROP TABLE IF EXISTS pipeline_checkpoints CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_checkpoint;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_checkpoint;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_checkpoint;
