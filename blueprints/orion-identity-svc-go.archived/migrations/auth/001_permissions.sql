-- Migration: Create permissions and user_permissions tables for orion-auth-svc-go
-- Permission CRUD + user/role assignment

-- permissions table: stores permission definitions (service_name, permission_key)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    service_name VARCHAR(128) NOT NULL,
    permission_key VARCHAR(128) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, service_name, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_permissions_tenant ON permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_permissions_service ON permissions(tenant_id, service_name);

-- user_permissions table: assigns permissions to users and/or roles
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    role_id VARCHAR(128),
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by VARCHAR(128),
    UNIQUE(tenant_id, user_id, role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_tenant_user ON user_permissions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_tenant_role ON user_permissions(tenant_id, role_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);

-- roles table: simple role definitions (if not already present)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

-- user_roles table: assigns roles to users
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
