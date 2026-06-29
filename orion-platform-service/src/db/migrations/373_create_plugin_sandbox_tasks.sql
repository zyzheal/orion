-- Migration 373: Create plugin_sandbox_tasks table
-- 用于 PluginSandbox PostgreSQL 持久化，支持执行记录查询和故障恢复

CREATE TABLE IF NOT EXISTS plugin_sandbox_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_id VARCHAR(200) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugin_sandbox_tenant ON plugin_sandbox_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_sandbox_plugin ON plugin_sandbox_tasks(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_sandbox_status ON plugin_sandbox_tasks(status);
