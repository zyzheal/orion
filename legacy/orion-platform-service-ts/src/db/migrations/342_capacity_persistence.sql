-- Migration 342: Capacity Planning persistence tables
-- Replaces in-memory Map() storage with PostgreSQL

CREATE TABLE IF NOT EXISTS capacity_metrics (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  metric_name VARCHAR(64) NOT NULL,
  current_value DOUBLE PRECISION NOT NULL,
  max_value DOUBLE PRECISION NOT NULL,
  unit VARCHAR(32) NOT NULL,
  utilization_percent DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capacity_metrics_tenant ON capacity_metrics(tenant_id);
CREATE INDEX idx_capacity_metrics_type ON capacity_metrics(tenant_id, resource_type);
CREATE INDEX idx_capacity_metrics_name ON capacity_metrics(tenant_id, metric_name);
CREATE INDEX idx_capacity_metrics_created ON capacity_metrics(tenant_id, created_at DESC);

ALTER TABLE capacity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON capacity_metrics
  USING (tenant_id = current_setting('app.current_tenant_id', true));


CREATE TABLE IF NOT EXISTS capacity_forecasts (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  metric_name VARCHAR(64) NOT NULL,
  current_utilization DOUBLE PRECISION NOT NULL,
  forecast_30_days DOUBLE PRECISION NOT NULL,
  forecast_90_days DOUBLE PRECISION NOT NULL,
  estimated_exhaust_date TIMESTAMPTZ,
  recommended_action TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capacity_forecasts_tenant ON capacity_forecasts(tenant_id);
CREATE INDEX idx_capacity_forecasts_generated ON capacity_forecasts(tenant_id, generated_at DESC);

ALTER TABLE capacity_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_forecasts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON capacity_forecasts
  USING (tenant_id = current_setting('app.current_tenant_id', true));


CREATE TABLE IF NOT EXISTS capacity_alerts (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  metric_name VARCHAR(64) NOT NULL,
  current_utilization DOUBLE PRECISION NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  severity VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capacity_alerts_tenant ON capacity_alerts(tenant_id);
CREATE INDEX idx_capacity_alerts_severity ON capacity_alerts(tenant_id, severity);

ALTER TABLE capacity_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON capacity_alerts
  USING (tenant_id = current_setting('app.current_tenant_id', true));


CREATE TABLE IF NOT EXISTS capacity_reports (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  alerts JSONB NOT NULL DEFAULT '[]',
  forecasts JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capacity_reports_tenant ON capacity_reports(tenant_id, generated_at DESC);

ALTER TABLE capacity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON capacity_reports
  USING (tenant_id = current_setting('app.current_tenant_id', true));
