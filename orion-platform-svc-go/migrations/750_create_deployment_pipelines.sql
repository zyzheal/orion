-- Migration 750: DevOps deployment pipeline definitions
CREATE TABLE IF NOT EXISTS deployment_pipelines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    repository_url  TEXT,
    branch_filter   TEXT DEFAULT '*',
    stages          JSONB NOT NULL DEFAULT '[]',
    trigger_type    TEXT NOT NULL DEFAULT 'manual',
    -- Types: manual, webhook, cron, push
    variables       JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_deployment_pipelines_tenant ON deployment_pipelines(tenant_id, enabled);
