-- Rollback Migration 006_create_builds
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: build_environments
DROP TABLE IF EXISTS build_environments CASCADE;

-- Dropping table: builds
DROP TABLE IF EXISTS builds CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_build_env;
DROP INDEX IF EXISTS CREATE INDEX idx_build;
DROP INDEX IF EXISTS CREATE INDEX idx_build;
DROP INDEX IF EXISTS CREATE INDEX idx_build;
