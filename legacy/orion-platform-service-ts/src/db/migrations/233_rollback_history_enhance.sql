-- Migration 233: Rollback History Enhancement
-- Add tenant_id column to rollback_history table for multi-tenant support

ALTER TABLE rollback_history ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

CREATE INDEX IF NOT EXISTS idx_rollback_history_tenant ON rollback_history(tenant_id);

-- Rollback:
-- ALTER TABLE rollback_history DROP COLUMN IF EXISTS tenant_id;
