-- Migration 291: ConnectorRegistry Map() to PostgreSQL
-- Migrates connector registrations from in-memory Map storage

CREATE TABLE IF NOT EXISTS connector_registry (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  capabilities TEXT NOT NULL DEFAULT '[]',
  config TEXT DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connector_registry_name ON connector_registry(name);
CREATE INDEX IF NOT EXISTS idx_connector_registry_enabled ON connector_registry(enabled);
CREATE INDEX IF NOT EXISTS idx_connector_registry_tenant ON connector_registry(tenant_id);
