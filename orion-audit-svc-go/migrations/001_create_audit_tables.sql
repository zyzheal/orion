CREATE TABLE IF NOT EXISTS audit_logs (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	action VARCHAR(128) NOT NULL,
	resource_type VARCHAR(128) NOT NULL,
	resource_id VARCHAR(256) NOT NULL DEFAULT '',
	actor_id VARCHAR(128) NOT NULL DEFAULT '',
	actor_name VARCHAR(256) NOT NULL DEFAULT '',
	details JSONB NOT NULL DEFAULT '{}',
	ip_address VARCHAR(64) NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(tenant_id, action, resource_type);
