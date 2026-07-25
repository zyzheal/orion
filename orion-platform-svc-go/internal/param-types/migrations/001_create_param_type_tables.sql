-- N-15: Parameter Type Handler
-- Tables for auto-exec job parameter type catalog + templates.

CREATE TABLE IF NOT EXISTS script_param_types (
    id            TEXT PRIMARY KEY,
    tenant_id     TEXT    NOT NULL DEFAULT '',
    name          TEXT    NOT NULL,
    code          TEXT    NOT NULL,  -- string|number|boolean|...
    label         TEXT    NOT NULL DEFAULT '',
    category      TEXT    NOT NULL DEFAULT 'basic',
    default_value TEXT    NOT NULL DEFAULT '',
    validation    JSONB            DEFAULT '{}',
    options       JSONB            DEFAULT '{}',
    enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS script_param_templates (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT        NOT NULL DEFAULT '',
    name         TEXT        NOT NULL,
    param_type   TEXT        NOT NULL,  -- references script_param_types.code
    required     BOOLEAN     NOT NULL DEFAULT FALSE,
    position     INTEGER     NOT NULL DEFAULT 0,
    example      TEXT        NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_param_types_tenant ON script_param_types (tenant_id);
CREATE INDEX IF NOT EXISTS idx_script_param_types_code    ON script_param_types (code);
CREATE INDEX IF NOT EXISTS idx_script_param_templates_tenant ON script_param_templates (tenant_id);
