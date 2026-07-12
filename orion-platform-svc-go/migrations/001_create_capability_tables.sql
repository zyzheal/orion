-- Capability module tables

CREATE TABLE IF NOT EXISTS capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_capabilities_tenant_id ON capabilities(tenant_id);

CREATE TABLE IF NOT EXISTS temporary_permissions (
    id BIGINT PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    capability_id VARCHAR(255) NOT NULL,
    environment_suffix VARCHAR(50),
    reason TEXT NOT NULL,
    granted_by VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_temporary_permissions_tenant_id ON temporary_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_temporary_permissions_user_id ON temporary_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_temporary_permissions_capability_id ON temporary_permissions(capability_id);

CREATE TABLE IF NOT EXISTS capability_audit_logs (
    id BIGINT PRIMARY KEY,
    tenant_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_capability_audit_logs_tenant_id ON capability_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_capability_audit_logs_user_id ON capability_audit_logs(user_id);

CREATE TABLE IF NOT EXISTS permission_requests (
    id BIGINT PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    capability_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_permission_requests_tenant_id ON permission_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_user_id ON permission_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
