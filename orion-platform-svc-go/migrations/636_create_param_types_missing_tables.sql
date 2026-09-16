-- 636_create_param_types_missing_tables.sql
-- param-types 模块: script_param_types / script_param_templates 2 张表无 CREATE TABLE。
-- 回滚见 636_create_param_types_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS script_param_types (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    name           TEXT NOT NULL,
    code           TEXT NOT NULL,
    label          TEXT NOT NULL DEFAULT '',
    category       TEXT NOT NULL DEFAULT '',
    default_value  TEXT NOT NULL DEFAULT '',
    validation     JSONB DEFAULT '{}',
    options        JSONB DEFAULT '[]',
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_script_param_types_tenant ON script_param_types(tenant_id);

CREATE TABLE IF NOT EXISTS script_param_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    param_type  TEXT NOT NULL,
    required    BOOLEAN NOT NULL DEFAULT FALSE,
    position    INTEGER NOT NULL DEFAULT 0,
    example     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_script_param_templates_tenant ON script_param_templates(tenant_id);
