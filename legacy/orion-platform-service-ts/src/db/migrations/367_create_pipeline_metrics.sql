-- Migration 367: Create pipeline_metrics table for PostgreSQL persistence
-- Tracks pipeline run metrics: duration, success/failure rates, error classification

CREATE TABLE IF NOT EXISTS pipeline_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  pipeline_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  trigger_type VARCHAR(20),
  error_type VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_metrics_tenant ON pipeline_metrics(tenant_id);
CREATE INDEX idx_pipeline_metrics_run ON pipeline_metrics(run_id);
CREATE INDEX idx_pipeline_metrics_pipeline ON pipeline_metrics(pipeline_id);
CREATE INDEX idx_pipeline_metrics_status ON pipeline_metrics(status);
CREATE INDEX idx_pipeline_metrics_created ON pipeline_metrics(created_at DESC);
