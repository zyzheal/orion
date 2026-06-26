-- Migration 327: Form Definitions + Instances (动态表单引擎)
-- 动态表单定义与实例

CREATE TABLE IF NOT EXISTS form_definitions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    schema          JSONB NOT NULL DEFAULT '{}',
    layout          JSONB NOT NULL DEFAULT '{}',
    validation_rules JSONB NOT NULL DEFAULT '{}',
    version         INTEGER NOT NULL DEFAULT 1,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_form_definitions_tenant ON form_definitions(tenant_id);

ALTER TABLE form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY form_definitions_tenant_isolation ON form_definitions
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS form_instances (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    form_id         TEXT NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
    data            JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'draft',
    submitted_by    TEXT,
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_instances_tenant ON form_instances(tenant_id);
CREATE INDEX idx_form_instances_form ON form_instances(form_id, created_at DESC);
CREATE INDEX idx_form_instances_status ON form_instances(status);

ALTER TABLE form_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_instances FORCE ROW LEVEL SECURITY;
CREATE POLICY form_instances_tenant_isolation ON form_instances
    USING (tenant_id = current_setting('app.current_tenant_id', true));
