CREATE TABLE IF NOT EXISTS risk_items (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	risk_type VARCHAR(64) NOT NULL, level VARCHAR(16) NOT NULL DEFAULT 'medium', description TEXT, mitigation TEXT, status VARCHAR(32) NOT NULL DEFAULT 'open',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_risk_items_tenant ON risk_items(tenant_id, created_at);
