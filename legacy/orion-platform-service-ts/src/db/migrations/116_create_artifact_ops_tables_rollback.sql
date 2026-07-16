-- Rollback Migration 116_create_artifact_ops_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: artifact_operations
DROP TABLE IF EXISTS artifact_operations CASCADE;

-- Dropping table: retention_policies
DROP TABLE IF EXISTS retention_policies CASCADE;

-- Dropping table: retention_evaluations
DROP TABLE IF EXISTS retention_evaluations CASCADE;

-- Dropping table: scan_reports
DROP TABLE IF EXISTS scan_reports CASCADE;

-- Dropping table: scan_findings
DROP TABLE IF EXISTS scan_findings CASCADE;

-- Dropping table: malicious_detections
DROP TABLE IF EXISTS malicious_detections CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_artifact_op;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_op;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_op;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_op;
DROP INDEX IF EXISTS CREATE INDEX idx_artifact_op;
DROP INDEX IF EXISTS CREATE INDEX idx_retention_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_retention_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_retention_eval;
DROP INDEX IF EXISTS CREATE INDEX idx_retention_eval;
DROP INDEX IF EXISTS CREATE INDEX idx_retention_eval;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_maliciou;
DROP INDEX IF EXISTS CREATE INDEX idx_maliciou;
DROP INDEX IF EXISTS CREATE INDEX idx_maliciou;
