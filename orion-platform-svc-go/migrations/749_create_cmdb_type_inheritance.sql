-- Migration 749: CMDB CI Type inheritance hierarchy
CREATE TABLE IF NOT EXISTS cmdb_type_inheritance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    parent_type_id  UUID NOT NULL REFERENCES cmdb_ci_types(id) ON DELETE CASCADE,
    child_type_id   UUID NOT NULL REFERENCES cmdb_ci_types(id) ON DELETE CASCADE,
    depth           INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, parent_type_id, child_type_id)
);
CREATE INDEX idx_cmdb_type_inheritance_parent ON cmdb_type_inheritance(parent_type_id);
CREATE INDEX idx_cmdb_type_inheritance_child ON cmdb_type_inheritance(child_type_id);
