-- Create metrics table for MetricsService
-- P2 Fix: Add missing metrics table used by MetricsRepository

CREATE TABLE IF NOT EXISTS metrics (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  value NUMERIC NOT NULL,
  unit VARCHAR(32) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_tenant_name_time
  ON metrics (tenant_id, name, timestamp DESC);
