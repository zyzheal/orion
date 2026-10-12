-- Migration 754: Deployment execution runs
CREATE TABLE IF NOT EXISTS deployment_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    pipeline_id     UUID NOT NULL REFERENCES deployment_pipelines(id) ON DELETE CASCADE,
    environment_id  UUID REFERENCES deployment_environments(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- pending, running, success, failed, cancelled
    stage_status    JSONB NOT NULL DEFAULT '{}',
    triggered_by    TEXT NOT NULL DEFAULT 'system',
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    duration_sec    INTEGER,
    logs            TEXT,
    artifact_url    TEXT
);
CREATE INDEX idx_deployment_runs_pipeline ON deployment_runs(pipeline_id, created_at DESC);
CREATE INDEX idx_deployment_runs_status ON deployment_runs(tenant_id, status);
