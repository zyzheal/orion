-- Heartbeat Registry persistence
-- Migrates HeartbeatWatchdog from in-memory Map to PostgreSQL

CREATE TABLE IF NOT EXISTS heartbeat_registry (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  task_id VARCHAR(255) NOT NULL,
  interval_ms INTEGER NOT NULL DEFAULT 5000,
  timeout_ms INTEGER NOT NULL DEFAULT 15000,
  last_beat BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_registry_tenant_id ON heartbeat_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_registry_task_id ON heartbeat_registry(task_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_registry_status ON heartbeat_registry(status);
