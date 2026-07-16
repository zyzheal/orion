-- Migration 326: Process Definitions + Instances (流程步骤引擎)
-- 流程定义与实例管理

CREATE TABLE IF NOT EXISTS process_definitions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    steps           JSONB NOT NULL DEFAULT '[]',
    variables       JSONB NOT NULL DEFAULT '{}',
    timeout_seconds INTEGER DEFAULT 3600,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_process_definitions_tenant ON process_definitions(tenant_id);

ALTER TABLE process_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY process_definitions_tenant_isolation ON process_definitions
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS process_instances (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    definition_id   TEXT NOT NULL REFERENCES process_definitions(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    current_step    INTEGER DEFAULT 0,
    input_variables JSONB NOT NULL DEFAULT '{}',
    output_variables JSONB NOT NULL DEFAULT '{}',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_process_instances_tenant ON process_instances(tenant_id);
CREATE INDEX idx_process_instances_definition ON process_instances(definition_id, created_at DESC);
CREATE INDEX idx_process_instances_status ON process_instances(status);

ALTER TABLE process_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_instances FORCE ROW LEVEL SECURITY;
CREATE POLICY process_instances_tenant_isolation ON process_instances
    USING (tenant_id = current_setting('app.current_tenant_id', true));
