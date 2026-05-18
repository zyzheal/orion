-- Rollback Migration 103_artifact_operations
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: artifact_operations
DROP TABLE IF EXISTS artifact_operations CASCADE;

-- Dropping table: artifact_scans
DROP TABLE IF EXISTS artifact_scans CASCADE;

-- Dropping table: artifact_retention_policies
DROP TABLE IF EXISTS artifact_retention_policies CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_artifact_operation;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_operation;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_operation;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_operation;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_operation;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_retention_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_retention_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_retention_policie;
