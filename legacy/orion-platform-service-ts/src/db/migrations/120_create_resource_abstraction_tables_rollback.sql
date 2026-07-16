-- Rollback Migration 120_create_resource_abstraction_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: unified_resources
DROP TABLE IF EXISTS unified_resources CASCADE;

-- Dropping table: deployment_results
DROP TABLE IF EXISTS deployment_results CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_unified_re;
DROP INDEX IF EXISTS CREATE INDEX idx_unified_re;
DROP INDEX IF EXISTS CREATE INDEX idx_unified_re;
DROP INDEX IF EXISTS CREATE INDEX idx_unified_re;
DROP INDEX IF EXISTS CREATE INDEX idx_deployment_re;
DROP INDEX IF EXISTS CREATE INDEX idx_deployment_re;
DROP INDEX IF EXISTS CREATE INDEX idx_deployment_re;
