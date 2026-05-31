-- ChatOps Command Handler registrations persistence
-- Migrates CommandRouter handlers Map() to PostgreSQL

CREATE TABLE IF NOT EXISTS chatops_command_handlers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64),
  command_name VARCHAR(128) NOT NULL,
  handler_type VARCHAR(32) NOT NULL DEFAULT 'builtin',
  service_name VARCHAR(128),
  method_name VARCHAR(128),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chatops_command_handlers_command ON chatops_command_handlers(command_name, tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatops_command_handlers_tenant_id ON chatops_command_handlers(tenant_id);
