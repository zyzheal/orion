-- Migration 0183: Metric Storage (Time-Series)
-- Metric registry and time-series data points for MetricCollector

-- Metric registry: stores metadata about registered metrics
CREATE TABLE IF NOT EXISTS metric_registry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  unit          VARCHAR(50) NOT NULL,
  default_tags  JSONB NOT NULL DEFAULT '{}',
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name)
);
CREATE INDEX idx_metric_registry_tenant ON metric_registry(tenant_id);
CREATE INDEX idx_metric_registry_name ON metric_registry(name);

-- Time-series data points: stores individual metric readings
CREATE TABLE IF NOT EXISTS metric_data_points (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_name   VARCHAR(200) NOT NULL,
  value         DOUBLE PRECISION NOT NULL,
  tags          JSONB NOT NULL DEFAULT '{}',
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metric_points_name_ts ON metric_data_points(metric_name, timestamp DESC);
CREATE INDEX idx_metric_points_tenant_ts ON metric_data_points(tenant_id, timestamp DESC);
CREATE INDEX idx_metric_points_ts ON metric_data_points(timestamp DESC);

-- Foreign key to metric_registry (created after index to avoid circular issues during bulk insert)
ALTER TABLE metric_data_points
  ADD CONSTRAINT fk_metric_points_name
  FOREIGN KEY (metric_name) REFERENCES metric_registry(name) ON DELETE CASCADE;
