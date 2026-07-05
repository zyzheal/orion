-- Migration 364: Config Metadata Persistence
-- Migrates config search metadata from in-memory array to PostgreSQL

CREATE TABLE IF NOT EXISTS config_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(100) NOT NULL,
  key VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  example JSONB,
  default_value JSONB,
  sensitivity VARCHAR(20) NOT NULL DEFAULT 'internal',
  tags TEXT[] DEFAULT '{}',
  validations JSONB,
  ui_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain, key)
);

CREATE INDEX IF NOT EXISTS idx_config_metadata_domain ON config_metadata(domain);
CREATE INDEX IF NOT EXISTS idx_config_metadata_key ON config_metadata(key);
CREATE INDEX IF NOT EXISTS idx_config_metadata_sensitivity ON config_metadata(sensitivity);
