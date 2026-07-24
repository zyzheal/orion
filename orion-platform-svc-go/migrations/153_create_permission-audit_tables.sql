-- Permission-Audit module tables (auto-generated)

CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    permission VARCHAR(255) NOT NULL,
    result VARCHAR(255) NOT NULL,
    ip_address VARCHAR(255) NOT NULL,
    user_agent VARCHAR(255) NOT NULL,
    context VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_tenant ON permission_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created ON permission_audit_logs(created_at DESC);

