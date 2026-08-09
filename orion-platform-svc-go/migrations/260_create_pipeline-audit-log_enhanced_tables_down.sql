-- Migration 260 down: remove enhanced columns and rename table back

BEGIN;

DROP INDEX IF EXISTS idx_pipeline_audit_logs_action;
DROP INDEX IF EXISTS idx_pipeline_audit_logs_resource;

ALTER TABLE IF EXISTS pipeline_audit_logs DROP COLUMN IF EXISTS ip_address;
ALTER TABLE IF EXISTS pipeline_audit_logs DROP COLUMN IF EXISTS details;
ALTER TABLE IF EXISTS pipeline_audit_logs DROP COLUMN IF EXISTS resource_id;
ALTER TABLE IF EXISTS pipeline_audit_logs DROP COLUMN IF EXISTS resource_type;

ALTER TABLE IF EXISTS pipeline_audit_logs RENAME TO audit_logs;

COMMIT;
