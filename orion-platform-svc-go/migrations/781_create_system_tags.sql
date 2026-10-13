-- Migration 781: System Tags — 系统标签管理
CREATE TABLE IF NOT EXISTS system_tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    color           TEXT DEFAULT '#4472C4',
    category        TEXT DEFAULT 'general',
    description     TEXT,
    created_by      TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_system_tags_tenant ON system_tags(tenant_id, category);

# Tag assignments for resources
CREATE TABLE IF NOT EXISTS system_tag_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    tag_id          UUID NOT NULL REFERENCES system_tags(id) ON DELETE CASCADE,
    resource_type   TEXT NOT NULL,
    resource_id     UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, tag_id, resource_type, resource_id)
);
CREATE INDEX idx_system_tag_assignments_resource ON system_tag_assignments(resource_type, resource_id);
