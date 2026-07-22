-- Migration 012: Monitoring & Alerts
-- Monitoring configurations and alert records

CREATE TABLE IF NOT EXISTS monitoring_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  target        VARCHAR(500) NOT NULL,
  metric        VARCHAR(200) NOT NULL,
  threshold     JSONB NOT NULL,
  interval_sec  INT NOT NULL DEFAULT 60,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  notification_channels TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_monitoring_configs_tenant ON monitoring_configs(tenant_id);

-- Alert records
CREATE TABLE IF NOT EXISTS alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_id     UUID REFERENCES monitoring_configs(id) ON DELETE SET NULL,
  severity      VARCHAR(20) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  message       TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'firing',
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  value         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- Alert correlations
CREATE TABLE IF NOT EXISTS alert_correlations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id      UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  correlated_alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  correlation_type VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollback:
-- DROP TABLE IF EXISTS alert_correlations, alerts, monitoring_configs;
