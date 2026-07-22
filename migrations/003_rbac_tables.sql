-- Migration 003: RBAC/ABAC tables for unified permission system
-- Implements the database schema from docs/security/权限系统统一规范.md Section 9

-- ============================================================
-- RBAC Core Tables
-- ============================================================

-- Roles table (32+ roles across 4 tiers)
CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id),
    name            VARCHAR(100) NOT NULL,
    display_name    VARCHAR(200) NOT NULL,
    description     TEXT,
    tier            VARCHAR(20) NOT NULL CHECK (tier IN ('system', 'business', 'project', 'module')),
    is_system       BOOLEAN NOT NULL DEFAULT false,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- Permissions table (resource:action format)
CREATE TABLE IF NOT EXISTS permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource        VARCHAR(100) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(resource, action)
);

-- Role-permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- User-role mapping
CREATE TABLE IF NOT EXISTS user_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id       UUID REFERENCES tenants(id),
    project_id      UUID, -- NULL for system/business roles, set for project roles
    granted_by      UUID REFERENCES users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ, -- NULL = never expires
    UNIQUE(user_id, role_id, project_id)
);

-- Role inheritance relationships
CREATE TABLE IF NOT EXISTS role_inheritance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_role     VARCHAR(100) NOT NULL,
    child_role      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(parent_role, child_role)
);

-- ============================================================
-- ABAC Tables
-- ============================================================

-- ABAC policy rules
CREATE TABLE IF NOT EXISTS abac_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id),
    name            VARCHAR(200) NOT NULL,
    effect          VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
    resource_type   VARCHAR(100) NOT NULL,
    action_type     VARCHAR(50) NOT NULL,
    subject_conditions  JSONB NOT NULL DEFAULT '{}',
    resource_conditions JSONB NOT NULL DEFAULT '{}',
    environment_conditions JSONB NOT NULL DEFAULT '{}',
    priority        INT NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Project-level RBAC
-- ============================================================

-- Project members with project-scoped roles
CREATE TABLE IF NOT EXISTS project_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID REFERENCES tenants(id),
    role            VARCHAR(50) NOT NULL,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- ============================================================
-- Resource Tags (for ABAC conditions)
-- ============================================================

CREATE TABLE IF NOT EXISTS resource_tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type   VARCHAR(100) NOT NULL,
    resource_id     UUID NOT NULL,
    tag             VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(resource_type, resource_id, tag)
);

-- ============================================================
-- Audit
-- ============================================================

-- Permission decision audit log
CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    resource_type   VARCHAR(100),
    resource_id     UUID,
    action          VARCHAR(50),
    decision        VARCHAR(10) CHECK (decision IN ('allow', 'deny')),
    decision_source VARCHAR(50),  -- 'rbac', 'abac', 'relationship', 'rls'
    reason          TEXT,
    evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_roles_tenant ON roles(tenant_id);
CREATE INDEX idx_roles_tier ON roles(tier);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_tenant ON user_roles(tenant_id);
CREATE INDEX idx_abac_policies_tenant ON abac_policies(tenant_id);
CREATE INDEX idx_abac_policies_resource ON abac_policies(resource_type, action_type);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_resource_tags_lookup ON resource_tags(resource_type, resource_id);
CREATE INDEX idx_permission_audit_logs_tenant ON permission_audit_logs(tenant_id);
CREATE INDEX idx_permission_audit_logs_user ON permission_audit_logs(user_id);
CREATE INDEX idx_permission_audit_logs_time ON permission_audit_logs(evaluated_at);

-- ============================================================
-- Seed data: Role inheritance chains
-- ============================================================

-- System admin chain
INSERT INTO role_inheritance (parent_role, child_role) VALUES
    ('super_admin', 'platform_admin'),
    ('platform_admin', 'tenant_admin'),
    ('tenant_admin', 'org_admin')
ON CONFLICT DO NOTHING;

-- Project chain
INSERT INTO role_inheritance (parent_role, child_role) VALUES
    ('project_admin', 'project_lead'),
    ('project_lead', 'project_developer'),
    ('project_developer', 'project_viewer')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed data: Permissions (resource:action matrix)
-- ============================================================

INSERT INTO permissions (resource, action) VALUES
    ('project', 'read'), ('project', 'write'), ('project', 'delete'),
    ('pipeline', 'read'), ('pipeline', 'write'), ('pipeline', 'execute'), ('pipeline', 'delete'), ('pipeline', 'approve'),
    ('deployment', 'read'), ('deployment', 'write'), ('deployment', 'execute'), ('deployment', 'delete'), ('deployment', 'approve'),
    ('environment', 'read'), ('environment', 'write'), ('environment', 'execute'), ('environment', 'manage'),
    ('alert', 'read'), ('alert', 'write'), ('alert', 'execute'), ('alert', 'delete'),
    ('config', 'read'), ('config', 'write'), ('config', 'manage'),
    ('artifact', 'read'), ('artifact', 'write'), ('artifact', 'delete'),
    ('ticket', 'read'), ('ticket', 'write'), ('ticket', 'manage'),
    ('audit_log', 'read'),
    ('tenant', 'read'), ('tenant', 'write'), ('tenant', 'manage'),
    ('user', 'read'), ('user', 'write'), ('user', 'delete'), ('user', 'manage'),
    ('role', 'read'), ('role', 'write'), ('role', 'delete'),
    ('finops', 'read'), ('finops', 'write'), ('finops', 'manage'),
    ('cmdb', 'read'), ('cmdb', 'write'), ('cmdb', 'manage'),
    ('secrets', 'read'), ('secrets', 'write'), ('secrets', 'delete'), ('secrets', 'manage'),
    ('approval', 'read'), ('approval', 'execute'), ('approval', 'manage'), ('approval', 'approve'),
    ('knowledge', 'read'), ('knowledge', 'write'), ('knowledge', 'delete'), ('knowledge', 'manage'),
    ('security', 'read'), ('security', 'write'), ('security', 'manage'),
    ('notification', 'read'), ('notification', 'write'),
    ('skill', 'read'), ('skill', 'write'), ('skill', 'execute')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE roles IS 'Role definitions across 4 tiers: system, business, project, module';
COMMENT ON TABLE permissions IS 'Permission definitions in resource:action format';
COMMENT ON TABLE role_permissions IS 'Maps roles to their permissions';
COMMENT ON TABLE user_roles IS 'Maps users to roles, optionally scoped to a project';
COMMENT ON TABLE role_inheritance IS 'Role inheritance chains (child inherits parent permissions)';
COMMENT ON TABLE abac_policies IS 'ABAC deny-only policy rules';
COMMENT ON TABLE project_members IS 'Project-level membership with roles';
COMMENT ON TABLE permission_audit_logs IS 'Audit trail for all permission decisions';
