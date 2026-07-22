-- 001_create_audit_tables.sql
-- Full audit_logs table matching Node.js AuditRepository.ts schema.
-- Includes hash chain columns (prev_hash, hash) for integrity verification,
-- and full request/response fields for audit detail.

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(128) NOT NULL,
    resource_id VARCHAR(256),
    request_method VARCHAR(16),
    request_path VARCHAR(512),
    request_body JSONB,
    response_code INTEGER,
    response_body JSONB,
    ip_address VARCHAR(64),
    user_agent VARCHAR(512),
    prev_hash VARCHAR(64),
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(tenant_id, action, resource_type);
CREATE INDEX idx_audit_logs_user ON audit_logs(tenant_id, user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(tenant_id, resource_id);

-- Retention policies: one per tenant, controls audit log lifecycle.
CREATE TABLE IF NOT EXISTS audit_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL DEFAULT 365,
    archive_before_delete BOOLEAN NOT NULL DEFAULT true,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_retention_policies_enabled ON audit_retention_policies(enabled);

-- Archive table for retained audit logs (audit_logs_archive).
CREATE TABLE IF NOT EXISTS audit_logs_archive (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(128) NOT NULL,
    resource_id VARCHAR(256),
    request_method VARCHAR(16),
    request_path VARCHAR(512),
    request_body JSONB,
    response_code INTEGER,
    response_body JSONB,
    ip_address VARCHAR(64),
    user_agent VARCHAR(512),
    prev_hash VARCHAR(64),
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_audit_logs_archive_tenant ON audit_logs_archive(tenant_id, created_at);
