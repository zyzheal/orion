-- Migration 053: Metrics Table
-- Supports the /api/v1/metrics API for recording, querying, and aggregating metrics

CREATE TABLE IF NOT EXISTS metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  name          VARCHAR(200) NOT NULL,
  value         DOUBLE PRECISION NOT NULL,
  unit          VARCHAR(50) NOT NULL DEFAULT '',
  labels        JSONB DEFAULT '{}',
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_metrics_tenant ON metrics(tenant_id);
CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp DESC);
CREATE INDEX idx_metrics_tenant_name_ts ON metrics(tenant_id, name, timestamp DESC);

-- Comment
COMMENT ON TABLE metrics IS 'Time-series metrics data for monitoring and analysis';

-- Rollback:
-- DROP TABLE IF EXISTS metrics;
