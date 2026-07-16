-- Rollback Migration 135_create_artifact_version_tracking
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: artifact_version_tracking
DROP TABLE IF EXISTS artifact_version_tracking CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_artifact_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_ver;
