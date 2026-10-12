-- Migration 733: CMDB CI Attribute Values — CI 属性值快照
CREATE TABLE IF NOT EXISTS cmdb_ci_attribute_values (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    ci_id           UUID NOT NULL,
    attribute_id    UUID NOT NULL,
    value           TEXT,
    value_type      TEXT NOT NULL DEFAULT 'string',
    -- string, number, boolean, date, json
    source          TEXT NOT NULL DEFAULT 'manual',
    -- manual, cmdb, probe, import
    updated_by      TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, ci_id, attribute_id)
);
CREATE INDEX idx_cmdb_ci_attr_values_ci ON cmdb_ci_attribute_values(ci_id);
CREATE INDEX idx_cmdb_ci_attr_values_attribute ON cmdb_ci_attribute_values(attribute_id);
