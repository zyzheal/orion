-- Rollback Migration 013_create_audit_logs
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: audit_logs
DROP TABLE IF EXISTS audit_logs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_log;
