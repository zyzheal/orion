-- Migration 775: RBAC Role Assignments — 用户-角色绑定
CREATE TABLE IF NOT EXISTS rbac_role_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    role_id         UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
    scope_type      TEXT NOT NULL DEFAULT 'global',
    -- global, project, team
    scope_id        TEXT,
    created_by      TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, role_id, scope_type, scope_id)
);
CREATE INDEX idx_rbac_role_assignments_user ON rbac_role_assignments(tenant_id, user_id);
CREATE INDEX idx_rbac_role_assignments_role ON rbac_role_assignments(role_id);
