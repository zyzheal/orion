-- Migration 323: Runbook Definitions (自动化手册)
-- Runbook 自动化定义与执行

CREATE TABLE IF NOT EXISTS runbook_definitions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT,
    steps           JSONB NOT NULL DEFAULT '[]',
    variables       JSONB NOT NULL DEFAULT '{}',
    timeout_seconds INTEGER DEFAULT 3600,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_runbook_definitions_tenant ON runbook_definitions(tenant_id);
CREATE INDEX idx_runbook_definitions_category ON runbook_definitions(category);

ALTER TABLE runbook_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE runbook_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY runbook_definitions_tenant_isolation ON runbook_definitions
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS runbook_executions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    runbook_id      TEXT NOT NULL REFERENCES runbook_definitions(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    triggered_by    TEXT,
    input_variables JSONB NOT NULL DEFAULT '{}',
    output          JSONB NOT NULL DEFAULT '{}',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runbook_executions_tenant ON runbook_executions(tenant_id);
CREATE INDEX idx_runbook_executions_runbook ON runbook_executions(runbook_id, created_at DESC);

ALTER TABLE runbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE runbook_executions FORCE ROW LEVEL SECURITY;
CREATE POLICY runbook_executions_tenant_isolation ON runbook_executions
    USING (tenant_id = current_setting('app.current_tenant_id', true));
