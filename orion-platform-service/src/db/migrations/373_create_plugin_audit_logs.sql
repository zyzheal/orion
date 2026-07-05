-- Migration 373: Plugin Audit Logs Persistence
-- Migrates plugin audit logging from in-memory Map to PostgreSQL storage
-- Table is separate from migration 128's plugin_audit_logs (which is for compliance)
-- and migration 236's plugin_audit_entries (which is for detailed execution traces)

CREATE TABLE IF NOT EXISTS plugin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_id VARCHAR(200) NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plugin_audit_tenant ON plugin_audit_logs(tenant_id);
CREATE INDEX idx_plugin_audit_plugin ON plugin_audit_logs(plugin_id);
CREATE INDEX idx_plugin_audit_created ON plugin_audit_logs(created_at DESC);
