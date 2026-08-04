-- Migration: Create alert pipeline results table
-- Persists PipelineResult after each pipeline execution for audit and listing.

CREATE TABLE IF NOT EXISTS alert_pipeline_results (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    result_id UUID NOT NULL,
    alert_id VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL,
    stages JSONB NOT NULL DEFAULT '[]'::jsonb,
    stage_count INT NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    error VARCHAR(1024),
    alert_name VARCHAR(256),
    severity VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_pipeline_results_tenant_id ON alert_pipeline_results (tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_pipeline_results_alert_id ON alert_pipeline_results (alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_pipeline_results_created_at ON alert_pipeline_results (created_at DESC);

COMMENT ON TABLE alert_pipeline_results IS 'Stores results of alert pipeline executions per tenant.';
