-- Migration 260: Rename audit_logs -> pipeline_audit_logs and add enhanced columns

BEGIN;

-- Rename existing table to match code expectations
ALTER TABLE IF EXISTS audit_logs RENAME TO pipeline_audit_logs;

-- Add new enhanced columns if they do not already exist
ALTER TABLE pipeline_audit_logs
ADD COLUMN IF NOT EXISTS resource_type VARCHAR(255);

ALTER TABLE pipeline_audit_logs
ADD COLUMN IF NOT EXISTS resource_id VARCHAR(255);

ALTER TABLE pipeline_audit_logs
ADD COLUMN IF NOT EXISTS details TEXT;

ALTER TABLE pipeline_audit_logs
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Index for new query patterns
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_resource
    ON pipeline_audit_logs(tenant_id, resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_action
    ON pipeline_audit_logs(tenant_id, action);

COMMIT;
