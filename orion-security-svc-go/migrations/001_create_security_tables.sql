CREATE TABLE IF NOT EXISTS security_scans (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	finding_type VARCHAR(64) NOT NULL, severity VARCHAR(16) NOT NULL DEFAULT 'medium', status VARCHAR(32) NOT NULL DEFAULT 'open', description TEXT, cve_id VARCHAR(32),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_security_scans_tenant ON security_scans(tenant_id, created_at);
