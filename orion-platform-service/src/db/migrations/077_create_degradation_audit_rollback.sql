-- Rollback Migration 077_create_degradation_audit
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: degradation_audit_logs
DROP TABLE IF EXISTS degradation_audit_logs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_degradation_audit_tenant ON degradation_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_degradation_audit_type ON degradation_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_degradation_audit_triggered ON degradation_audit_log;
