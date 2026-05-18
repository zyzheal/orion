-- Rollback Migration 039_create_build_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: build_cache
DROP TABLE IF EXISTS build_cache CASCADE;

-- Dropping table: build_logs
DROP TABLE IF EXISTS build_logs CASCADE;

-- Dropping table: build_artifacts
DROP TABLE IF EXISTS build_artifacts CASCADE;

-- Dropping table: test_predictions
DROP TABLE IF EXISTS test_predictions CASCADE;

-- Dropping table: test_dependencies
DROP TABLE IF EXISTS test_dependencies CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_build_cache_project ON build_cache(project_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_build_cache_;
DROP INDEX IF EXISTS CREATE INDEX idx_build_log;
DROP INDEX IF EXISTS CREATE INDEX idx_build_log;
DROP INDEX IF EXISTS CREATE INDEX idx_build_artifact;
DROP INDEX IF EXISTS CREATE INDEX idx_te;
