-- Migration 286: Config Entries Persistence
-- Migrates config entries from in-memory Map to PostgreSQL

CREATE TABLE IF NOT EXISTS config_entries (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  key VARCHAR(200) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  version INT NOT NULL DEFAULT 1,
  environment VARCHAR(50) DEFAULT 'default',
  status VARCHAR(30) DEFAULT 'active',
  description TEXT,
  encrypted BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]',
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_config_entries_tenant ON config_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_entries_key ON config_entries(key);
CREATE INDEX IF NOT EXISTS idx_config_entries_status ON config_entries(status);

CREATE TABLE IF NOT EXISTS config_entry_history (
  id VARCHAR(100) PRIMARY KEY,
  config_id VARCHAR(100) NOT NULL REFERENCES config_entries(id) ON DELETE CASCADE,
  old_value JSONB,
  new_value JSONB NOT NULL,
  changed_by VARCHAR(64),
  change_log TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_entry_history_config ON config_entry_history(config_id);
