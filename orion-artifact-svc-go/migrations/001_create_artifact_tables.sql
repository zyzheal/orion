CREATE TABLE IF NOT EXISTS artifacts (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	description TEXT, type VARCHAR(64) NOT NULL DEFAULT 'docker', version VARCHAR(128), repo_url TEXT, size_bytes BIGINT DEFAULT 0, metadata JSONB DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_artifacts_tenant ON artifacts(tenant_id, created_at);
