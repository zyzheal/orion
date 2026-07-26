CREATE TABLE IF NOT EXISTS contributions (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	post_type VARCHAR(32) NOT NULL DEFAULT 'discussion', content TEXT NOT NULL, author VARCHAR(128), tags JSONB DEFAULT '[]', votes INT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contributions_tenant ON contributions(tenant_id, created_at);
