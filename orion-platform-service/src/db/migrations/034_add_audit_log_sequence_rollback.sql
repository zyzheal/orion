-- Rollback Migration 034_add_audit_log_sequence
-- Auto-generated rollback script
-- Review carefully before executing in production

DROP INDEX IF EXISTS CREATE INDEX idx_audit_log;
