-- Rollback Migration 128_plugin_audit_logs
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: plugin_audit_logs
DROP TABLE IF EXISTS plugin_audit_logs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_audit_ta;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_plugin ON plugin_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_tenant ON plugin_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_created ON plugin_audit_log;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_action ON plugin_audit_log;
