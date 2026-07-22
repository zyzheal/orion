-- Rollback Migration 092_autonomous_pipeline
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_error_classification
DROP TABLE IF EXISTS pipeline_error_classification CASCADE;

-- Dropping table: pipeline_stage_baselines
DROP TABLE IF EXISTS pipeline_stage_baselines CASCADE;

-- Dropping table: pipeline_auto_retries
DROP TABLE IF EXISTS pipeline_auto_retries CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_error_cla;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_error_cla;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_error_cla;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_error_cla;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_auto_retrie;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_auto_retrie;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_auto_retrie;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_auto_retrie;
DROP INDEX IF EXISTS idx_pipeline_error_cla;
DROP INDEX IF EXISTS idx_pipeline_;
DROP INDEX IF EXISTS idx_pipeline_auto_retrie;
