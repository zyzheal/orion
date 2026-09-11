-- Migration 260 down: remove enhanced columns and rename table back

-- NOTE: the migration runner (database.RunMigrations) already wraps each
-- file in its own transaction, so a literal BEGIN;/COMMIT; here commits the
-- runner's transaction early and makes tx.Commit() fail with
-- "pq: unexpected transaction status idle".

DROP INDEX IF EXISTS idx_pipeline_audit_logs_action;
DROP INDEX IF EXISTS idx_pipeline_audit_logs_resource;

ALTER TABLE IF EXISTS pipeline_audit_logs DROP COLUMN IF EXISTS ip_address;
ALTER TABLE IF EXISTS pipeline_audit_logs DROP COLUMN IF EXISTS details;
ALTER TABLE IF EXISTS pipeline_audit_logs DROP COLUMN IF EXISTS resource_id;
ALTER TABLE IF EXISTS pipeline_audit_logs DROP COLUMN IF EXISTS resource_type;

ALTER TABLE IF EXISTS pipeline_audit_logs RENAME TO audit_logs;

