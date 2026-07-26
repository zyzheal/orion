CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rules JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    enforcement_level VARCHAR(32) NOT NULL DEFAULT 'warn',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policies_tenant ON policies(tenant_id, status);

CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(128) NOT NULL,
    resource_id VARCHAR(256) NOT NULL,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
    score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    findings JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_assessments_tenant ON risk_assessments(tenant_id, risk_level);
CREATE INDEX idx_risk_assessments_resource ON risk_assessments(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    actor VARCHAR(256) NOT NULL,
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(128) NOT NULL,
    resource_id VARCHAR(256) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor, action);
