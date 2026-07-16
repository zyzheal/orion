-- Rollback Migration 081_create_pipeline_versions
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_versions
DROP TABLE IF EXISTS pipeline_versions CASCADE;

-- Dropping table: pipeline_budgets
DROP TABLE IF EXISTS pipeline_budgets CASCADE;

-- Dropping table: pipeline_templates
DROP TABLE IF EXISTS pipeline_templates CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_budget;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_template;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_template;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_template;
