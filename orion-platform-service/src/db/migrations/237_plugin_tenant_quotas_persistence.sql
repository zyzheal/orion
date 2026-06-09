-- Migration 237: Plugin Tenant Quotas Persistence
-- Stores per-tenant resource quotas in PostgreSQL instead of in-memory Map()

CREATE TABLE IF NOT EXISTS plugin_tenant_quotas (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' UNIQUE,
  cpu_cores INTEGER NOT NULL DEFAULT 2,
  memory_bytes BIGINT NOT NULL DEFAULT 4294967296,
  timeout_ms INTEGER NOT NULL DEFAULT 120000,
  max_concurrent INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_tenant_quotas_tenant_id ON plugin_tenant_quotas(tenant_id);
