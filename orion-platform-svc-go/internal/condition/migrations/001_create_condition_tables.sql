-- condition: condition engine tables for nested condition group evaluation
-- Migration 001 — creates condition_groups, condition_expressions

CREATE TABLE IF NOT EXISTS condition_groups (
    id              VARCHAR(64)  PRIMARY KEY,
    tenant_id       VARCHAR(64)  NOT NULL,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(16)  NOT NULL DEFAULT 'and',
    children        JSONB        DEFAULT '[]',
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    description     TEXT         DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS condition_expressions (
    id           VARCHAR(64)  PRIMARY KEY,
    group_id     VARCHAR(64)  NOT NULL REFERENCES condition_groups(id) ON DELETE CASCADE,
    field        VARCHAR(255) NOT NULL,
    operator     VARCHAR(32)  NOT NULL,
    value        TEXT         DEFAULT '',
    value_type   VARCHAR(16)  NOT NULL DEFAULT 'string',
    enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condition_groups_tenant ON condition_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_condition_groups_type ON condition_groups(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_condition_expressions_group ON condition_expressions(group_id);
CREATE INDEX IF NOT EXISTS idx_condition_expressions_operator ON condition_expressions(operator);
