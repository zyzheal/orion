-- 001_init.sql - Audit service tables
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    detail TEXT,
    user_id VARCHAR(255),
    tenant_id VARCHAR(255),
    ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_checks (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    target VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result TEXT,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_compliance_checks_tenant ON compliance_checks(tenant_id);
CREATE INDEX idx_compliance_checks_status ON compliance_checks(status);
