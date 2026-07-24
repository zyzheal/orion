-- Confirmation Module Rollback
-- Rollback for migration 056_create_confirmation_tables.sql

DROP INDEX IF EXISTS idx_confirmation_audit_timestamp;
DROP INDEX IF EXISTS idx_confirmation_audit_user;
DROP INDEX IF EXISTS idx_confirmation_audit_conf_id;
DROP INDEX IF EXISTS idx_confirmation_push_time;
DROP INDEX IF EXISTS idx_confirmation_tenant;
DROP INDEX IF EXISTS idx_confirmation_status;
DROP INDEX IF EXISTS idx_confirmation_priority;
DROP INDEX IF EXISTS idx_confirmation_scene_type;

DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS confirmation_audit_logs CASCADE;
DROP TABLE IF EXISTS confirmation_requests CASCADE;
