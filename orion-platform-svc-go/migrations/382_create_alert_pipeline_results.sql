-- Migration 382: alert-pipeline results table (was inline CREATE only)

CREATE TABLE IF NOT EXISTS alert_pipeline_results (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    result_id UUID NOT NULL,
    alert_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    stages JSONB DEFAULT '[]'::JSONB,
    stage_count INT DEFAULT 0,
    errors JSONB DEFAULT '[]'::JSONB,
    error TEXT,
    alert_name TEXT,
    severity TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_pipeline_results_result ON alert_pipeline_results(result_id);
CREATE INDEX IF NOT EXISTS idx_alert_pipeline_results_alert ON alert_pipeline_results(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_pipeline_results_tenant ON alert_pipeline_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_pipeline_results_created ON alert_pipeline_results(created_at DESC);