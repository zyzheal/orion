-- Migration 236: Plugin Audit Entries Persistence
-- Stores plugin audit log entries in PostgreSQL instead of in-memory Map()

CREATE TABLE IF NOT EXISTS plugin_audit_entries (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64),
  plugin_id VARCHAR(128),
  task_id VARCHAR(128),
  level VARCHAR(16) NOT NULL DEFAULT 'INFO',
  action VARCHAR(64) NOT NULL,
  message TEXT,
  input JSONB,
  output JSONB,
  duration_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  entry_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_audit_entries_tenant_id ON plugin_audit_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_audit_entries_plugin_id ON plugin_audit_entries(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_audit_entries_task_id ON plugin_audit_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_plugin_audit_entries_level ON plugin_audit_entries(level);
CREATE INDEX IF NOT EXISTS idx_plugin_audit_entries_action ON plugin_audit_entries(action);
CREATE INDEX IF NOT EXISTS idx_plugin_audit_entries_entry_at ON plugin_audit_entries(entry_at);
