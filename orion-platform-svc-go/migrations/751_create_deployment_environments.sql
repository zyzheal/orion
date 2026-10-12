-- Migration 751: DevOps environment definitions
CREATE TABLE IF NOT EXISTS deployment_environments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    environment_type TEXT NOT NULL,
    -- Types: development, staging, production, qa, perf
    description     TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    tier            TEXT NOT NULL DEFAULT 'standard',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_deployment_environments_tenant ON deployment_environments(tenant_id);
