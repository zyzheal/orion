-- Rollback Migration 135_create_pipeline_environments
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_environments
DROP TABLE IF EXISTS pipeline_environments CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_env;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_env;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_env;
