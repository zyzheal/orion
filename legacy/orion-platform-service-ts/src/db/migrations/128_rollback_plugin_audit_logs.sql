-- Rollback Migration 128: Drop plugin_audit_logs table

DROP POLICY IF EXISTS audit_logs_tenant_isolation ON plugin_audit_logs;
DROP TABLE IF EXISTS plugin_audit_logs CASCADE;
