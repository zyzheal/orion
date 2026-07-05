-- Migration 377: Config Audit Logs - PostgreSQL persistence
-- 配置审计日志表，用于记录所有配置操作的合规跟踪

CREATE TABLE IF NOT EXISTS config_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(20) NOT NULL DEFAULT 'config',
  resource_id TEXT NOT NULL DEFAULT '',
  resource_key VARCHAR(200),
  actor VARCHAR(100) NOT NULL,
  actor_role VARCHAR(50),
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_audit_tenant ON config_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_audit_key ON config_audit_logs(resource_key);
CREATE INDEX IF NOT EXISTS idx_config_audit_action ON config_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_config_audit_resource ON config_audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_config_audit_created ON config_audit_logs(created_at DESC);
