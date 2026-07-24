-- Rollback Migration 056_create_confirmation_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: confirmation_requests
DROP TABLE IF EXISTS confirmation_requests CASCADE;

-- Dropping table: confirmation_audit_logs
DROP TABLE IF EXISTS confirmation_audit_logs CASCADE;

-- Dropping table: notification_settings
DROP TABLE IF EXISTS notification_settings CASCADE;

DROP INDEX IF EXISTS idx_confirmation_;
DROP INDEX IF EXISTS idx_confirmation_priority ON confirmation_reque;
DROP INDEX IF EXISTS idx_confirmation_;
DROP INDEX IF EXISTS idx_confirmation_tenant ON confirmation_reque;
DROP INDEX IF EXISTS idx_confirmation_pu;
DROP INDEX IF EXISTS idx_confirmation_audit_conf_id ON confirmation_audit_log;
DROP INDEX IF EXISTS idx_confirmation_audit_u;
DROP INDEX IF EXISTS idx_confirmation_audit_time;
