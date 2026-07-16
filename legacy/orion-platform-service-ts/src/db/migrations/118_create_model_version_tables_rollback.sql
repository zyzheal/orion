-- Rollback Migration 118_create_model_version_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: model_versions
DROP TABLE IF EXISTS model_versions CASCADE;

-- Dropping table: ab_tests
DROP TABLE IF EXISTS ab_tests CASCADE;

-- Dropping table: ab_test_metrics
DROP TABLE IF EXISTS ab_test_metrics CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_model_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_ab_te;
DROP INDEX IF EXISTS CREATE INDEX idx_ab_te;
DROP INDEX IF EXISTS CREATE INDEX idx_ab_te;
DROP INDEX IF EXISTS CREATE INDEX idx_ab_te;
