-- Migration: 390_create_middleware_ops_tables.sql
-- Purpose: Persist middleware operations data (instances, metrics, alerts)

CREATE TABLE IF NOT EXISTS middleware_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  host VARCHAR(500) NOT NULL,
  port INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'healthy',
  version VARCHAR(50),
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS middleware_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  middleware_id UUID NOT NULL REFERENCES middleware_instances(id) ON DELETE CASCADE,
  metric_name VARCHAR(200) NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  unit VARCHAR(50),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS middleware_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  middleware_id UUID NOT NULL REFERENCES middleware_instances(id) ON DELETE CASCADE,
  middleware_name VARCHAR(200),
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  message TEXT,
  value NUMERIC DEFAULT 0,
  threshold NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_middleware_instances_tenant ON middleware_instances(tenant_id);
CREATE INDEX idx_middleware_metrics_tenant ON middleware_metrics(tenant_id);
CREATE INDEX idx_middleware_metrics_middleware ON middleware_metrics(middleware_id);
CREATE INDEX idx_middleware_metrics_timestamp ON middleware_metrics(timestamp DESC);
CREATE INDEX idx_middleware_alerts_tenant ON middleware_alerts(tenant_id);
CREATE INDEX idx_middleware_alerts_middleware ON middleware_alerts(middleware_id);
CREATE INDEX idx_middleware_alerts_created ON middleware_alerts(created_at DESC);
