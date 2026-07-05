-- Rollback Migration 385_create_agent_audit_logs
-- Revert: drop agent_audit_logs table and all indexes

DROP INDEX IF EXISTS idx_agent_audit_logs_agent_id;
DROP INDEX IF EXISTS "idx_agent_audit_logs_tenant";
DROP INDEX IF EXISTS idx_agent_audit_logs_status;
DROP INDEX IF EXISTS idx_agent_audit_logs_created;

DROP TABLE IF EXISTS agent_audit_logs CASCADE;
