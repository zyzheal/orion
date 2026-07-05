CREATE TABLE IF NOT EXISTS policies (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	policy_type VARCHAR(64) NOT NULL, rules JSONB NOT NULL DEFAULT '{}', severity VARCHAR(16) NOT NULL DEFAULT 'medium', enabled BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_policies_tenant ON policies(tenant_id, created_at);
