-- Migration 019: Efficiency & DORA Metrics
-- Developer efficiency and DORA metrics tracking

CREATE TABLE IF NOT EXISTS efficiency_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_type   VARCHAR(50) NOT NULL,
  value         JSONB NOT NULL,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_efficiency_metrics_tenant ON efficiency_metrics(tenant_id);
CREATE INDEX idx_efficiency_metrics_type ON efficiency_metrics(metric_type);
CREATE INDEX idx_efficiency_metrics_period ON efficiency_metrics(period_start, period_end);

-- DORA metric snapshots
CREATE TABLE IF NOT EXISTS dora_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployment_frequency INT,
  lead_time_minutes BIGINT,
  mttr_minutes  BIGINT,
  change_failure_rate DECIMAL(5,4),
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dora_snapshots_tenant ON dora_snapshots(tenant_id);

-- Rollback:
-- DROP TABLE IF EXISTS dora_snapshots, efficiency_metrics;
