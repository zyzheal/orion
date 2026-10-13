-- Migration 774: RBAC Roles — 角色定义
CREATE TABLE IF NOT EXISTS rbac_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    permissions     TEXT[] NOT NULL DEFAULT '{}',
    scope           TEXT NOT NULL DEFAULT 'global',
    -- global, project, team
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_rbac_roles_tenant ON rbac_roles(tenant_id, scope);
