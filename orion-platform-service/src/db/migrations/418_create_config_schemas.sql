-- Migration 418: Config Schemas
-- Supports JSON Schema validation for configuration management

CREATE TABLE IF NOT EXISTS config_schemas (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name VARCHAR(200) NOT NULL,
  description TEXT,
  schema JSONB NOT NULL DEFAULT '{}',
  config_key VARCHAR(200),
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(64) NOT NULL,
  updated_by VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_schemas_tenant ON config_schemas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_schemas_config_key ON config_schemas(config_key);
CREATE INDEX IF NOT EXISTS idx_config_schemas_tenant_name ON config_schemas(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_config_schemas_is_active ON config_schemas(is_active);
