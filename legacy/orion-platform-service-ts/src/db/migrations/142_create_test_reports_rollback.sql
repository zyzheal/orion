-- Rollback Migration 142_create_test_reports
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: test_reports
DROP TABLE IF EXISTS test_reports CASCADE;

-- Dropping table: test_cases
DROP TABLE IF EXISTS test_cases CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_te;
DROP INDEX IF EXISTS CREATE INDEX idx_te;
DROP INDEX IF EXISTS CREATE INDEX idx_te;
