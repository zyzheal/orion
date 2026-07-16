-- Migration: 412_federation_advanced_optimistic_lock.sql
-- Purpose: Add optimistic lock (version) and audit log support for federation advanced tables

-- Add version column for optimistic locking
ALTER TABLE federation_scheduling_policies ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE federation_cross_cluster_jobs ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE federation_resource_pools ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create federation audit log table for operation tracking
CREATE TABLE IF NOT EXISTS federation_audit_logs (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(200) NOT NULL,
  actor VARCHAR(200),
  changes JSONB DEFAULT '{}',
  prev_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_federation_audit_tenant ON federation_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_federation_audit_resource ON federation_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_federation_audit_created ON federation_audit_logs(created_at);
