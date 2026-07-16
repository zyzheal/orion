-- Migration 306: RBAC/ABAC Enhanced Tables for Phase 3
-- Adds: role_inheritance, abac_policies, project_members, permission_audit_logs
-- Extends the base RBAC tables from migration 002.

-- ============================================================
-- Role Inheritance (role → parent role mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_inheritance (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    parent_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, role_id, parent_role_id),
    CHECK (role_id != parent_role_id)
);
CREATE INDEX idx_role_inheritance_tenant ON role_inheritance(tenant_id);
CREATE INDEX idx_role_inheritance_role ON role_inheritance(role_id);
CREATE INDEX idx_role_inheritance_parent ON role_inheritance(parent_role_id);

-- Enable RLS
ALTER TABLE role_inheritance ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_role_inheritance ON role_inheritance
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- ABAC Policies (deny-only attribute-based policies)
-- ============================================================
CREATE TABLE IF NOT EXISTS abac_policies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name          VARCHAR(200) NOT NULL,
    description   TEXT,
    effect        VARCHAR(10) NOT NULL DEFAULT 'deny' CHECK (effect IN ('deny', 'allow')),
    resource      VARCHAR(100) NOT NULL,
    action        VARCHAR(50) NOT NULL,
    conditions    JSONB NOT NULL DEFAULT '{}',
    priority      INTEGER NOT NULL DEFAULT 0,
    enabled       BOOLEAN NOT NULL DEFAULT true,
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_abac_policies_tenant ON abac_policies(tenant_id);
CREATE INDEX idx_abac_policies_resource ON abac_policies(tenant_id, resource, action);
CREATE INDEX idx_abac_policies_conditions ON abac_policies USING GIN (conditions);

-- Enable RLS
ALTER TABLE abac_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abac_policies ON abac_policies
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- Project Members (project-level RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_members (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id    UUID NOT NULL,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          VARCHAR(50) NOT NULL DEFAULT 'viewer',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, project_id, user_id)
);
CREATE INDEX idx_project_members_tenant ON project_members(tenant_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_members ON project_members
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- Permission Audit Logs (authorization decision audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    user_id       UUID NOT NULL,
    resource      VARCHAR(100) NOT NULL,
    action        VARCHAR(50) NOT NULL,
    resource_id   VARCHAR(100),
    decision      VARCHAR(10) NOT NULL CHECK (decision IN ('allow', 'deny')),
    source        VARCHAR(20) NOT NULL CHECK (source IN ('rbac', 'abac', 'relationship', 'super_admin')),
    reason        TEXT,
    ip_address    INET,
    user_agent    TEXT,
    request_id    VARCHAR(100),
    chain_hash    VARCHAR(64),
    prev_hash     VARCHAR(64),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_permission_audit_tenant ON permission_audit_logs(tenant_id);
CREATE INDEX idx_permission_audit_user ON permission_audit_logs(user_id);
CREATE INDEX idx_permission_audit_resource ON permission_audit_logs(resource, action);
CREATE INDEX idx_permission_audit_created ON permission_audit_logs(created_at DESC);
CREATE INDEX idx_permission_audit_decision ON permission_audit_logs(decision);

-- Enable RLS
ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_permission_audit_logs ON permission_audit_logs
    USING (tenant_id = current_tenant_id());

-- ============================================================
-- Seed: 32 predefined roles across 4 tiers
-- ============================================================

-- Tier 1: Global roles (no tenant_id needed, is_system = true)
-- These are created per-tenant by the application when a tenant is provisioned.
-- Template roles for seed data:

-- INSERT INTO roles (tenant_id, name, description, is_system) VALUES
--   ($tenant, 'super_admin', 'Full system access', true),
--   ($tenant, 'org_admin', 'Organization administrator', true),
--   ($tenant, 'billing_admin', 'Billing management', true),
--   ($tenant, 'security_admin', 'Security policy management', true),
--   -- ... (32 roles total, applied per tenant)

-- ============================================================
-- Seed: Default permissions
-- ============================================================

INSERT INTO permissions (resource, action, description) VALUES
    ('pipelines', 'read', 'View pipelines'),
    ('pipelines', 'write', 'Create/update pipelines'),
    ('pipelines', 'delete', 'Delete pipelines'),
    ('pipelines', 'execute', 'Trigger pipeline runs'),
    ('deployments', 'read', 'View deployments'),
    ('deployments', 'write', 'Create/update deployments'),
    ('deployments', 'delete', 'Delete deployments'),
    ('deployments', 'execute', 'Trigger deployments'),
    ('secrets', 'read', 'View secrets'),
    ('secrets', 'write', 'Create/update secrets'),
    ('secrets', 'delete', 'Delete secrets'),
    ('monitoring', 'read', 'View monitoring dashboards'),
    ('monitoring', 'write', 'Create/update dashboards'),
    ('monitoring', 'execute', 'Acknowledge/resolve alerts'),
    ('tickets', 'read', 'View tickets'),
    ('tickets', 'write', 'Create/update tickets'),
    ('tickets', 'delete', 'Delete tickets'),
    ('tickets', 'execute', 'Approve/reject tickets'),
    ('users', 'read', 'View user list'),
    ('users', 'write', 'Manage users'),
    ('users', 'delete', 'Delete users'),
    ('roles', 'read', 'View roles'),
    ('roles', 'write', 'Create/update roles'),
    ('roles', 'delete', 'Delete roles'),
    ('config', 'read', 'View configuration'),
    ('config', 'write', 'Update configuration'),
    ('config', 'delete', 'Delete configuration'),
    ('finops', 'read', 'View cost data'),
    ('finops', 'write', 'Manage budgets'),
    ('finops', 'execute', 'Approve spend'),
    ('scheduler', 'read', 'View scheduled jobs'),
    ('scheduler', 'write', 'Create/update jobs'),
    ('scheduler', 'delete', 'Delete jobs'),
    ('scheduler', 'execute', 'Trigger/stop jobs'),
    ('audit', 'read', 'View audit logs'),
    ('audit', 'write', 'Export audit logs'),
    ('skills', 'read', 'View skills'),
    ('skills', 'write', 'Create/update skills'),
    ('skills', 'delete', 'Delete skills'),
    ('skills', 'execute', 'Execute skills'),
    ('cmdb', 'read', 'View CI items'),
    ('cmdb', 'write', 'Create/update CI items'),
    ('cmdb', 'delete', 'Delete CI items'),
    ('artifacts', 'read', 'View artifacts'),
    ('artifacts', 'write', 'Create/update artifacts'),
    ('artifacts', 'delete', 'Delete artifacts'),
    ('approvals', 'read', 'View approval requests'),
    ('approvals', 'write', 'Create approval requests'),
    ('approvals', 'execute', 'Approve/reject requests')
ON CONFLICT (resource, action) DO NOTHING;

-- Rollback:
-- DROP TABLE IF EXISTS permission_audit_logs, project_members, abac_policies, role_inheritance;
