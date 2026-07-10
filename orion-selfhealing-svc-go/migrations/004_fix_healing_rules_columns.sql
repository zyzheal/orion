-- Migration 004: Add missing columns to healing_rules and healing_executions

-- Add enabled, execution_count, updated_at to healing_rules
ALTER TABLE healing_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE healing_rules ADD COLUMN IF NOT EXISTS execution_count INT NOT NULL DEFAULT 0;
ALTER TABLE healing_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add tenant_id to healing_executions (for multi-tenancy)
ALTER TABLE healing_executions ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_executions_tenant ON healing_executions(tenant_id);
