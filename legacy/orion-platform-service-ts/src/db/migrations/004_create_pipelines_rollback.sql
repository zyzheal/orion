-- Rollback Migration 004_create_pipelines
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipelines
DROP TABLE IF EXISTS pipelines CASCADE;

-- Dropping table: pipeline_stages
DROP TABLE IF EXISTS pipeline_stages CASCADE;

-- Dropping table: stage_dependencies
DROP TABLE IF EXISTS stage_dependencies CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_;
