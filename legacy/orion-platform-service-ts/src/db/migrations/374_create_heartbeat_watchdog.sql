-- Heartbeat Watchdog persistence
-- Migrates HeartbeatWatchdog from in-memory Map to PostgreSQL heartbeat_watchdog table

CREATE TABLE IF NOT EXISTS heartbeat_watchdog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name VARCHAR(200) NOT NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(20) NOT NULL DEFAULT 'healthy',
  failure_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hbw_tenant ON heartbeat_watchdog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hbw_service ON heartbeat_watchdog(service_name);
CREATE INDEX IF NOT EXISTS idx_hbw_status ON heartbeat_watchdog(status);
