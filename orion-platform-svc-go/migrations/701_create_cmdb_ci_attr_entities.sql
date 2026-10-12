-- Migration 701: Create CMDB CI attribute entities table
-- ADR-013 Layer 2: 属性层 — 字段级约束 + JSONB 值存储

CREATE TABLE IF NOT EXISTS cmdb_ci_attr_entities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     TEXT NOT NULL,
    ci_id         UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    attr_name     TEXT NOT NULL,
    attr_value    JSONB NOT NULL DEFAULT '{}',
    attr_type     TEXT NOT NULL DEFAULT 'string',
    -- Types: string, integer, float, boolean, date, json
    source        TEXT NOT NULL DEFAULT 'manual',
    -- Sources: manual, collector, agent, imported
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cmdb_ci_attr_entities_ci
    ON cmdb_ci_attr_entities(tenant_id, ci_id);

CREATE INDEX idx_cmdb_ci_attr_entities_name
    ON cmdb_ci_attr_entities(tenant_id, attr_name);
