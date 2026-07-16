-- Rollback Migration 014_create_artifacts
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: artifact_repositories
DROP TABLE IF EXISTS artifact_repositories CASCADE;

-- Dropping table: artifact_versions
DROP TABLE IF EXISTS artifact_versions CASCADE;

-- Dropping table: artifact_promotions
DROP TABLE IF EXISTS artifact_promotions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_artifact_repo;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_ver;
