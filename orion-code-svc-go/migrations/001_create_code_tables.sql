CREATE TABLE IF NOT EXISTS code_repositories (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	repo_url TEXT NOT NULL, branch VARCHAR(256) NOT NULL DEFAULT 'main', commit_hash VARCHAR(64), language VARCHAR(32), lines_of_code INT DEFAULT 0, metadata JSONB DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_code_repositories_tenant ON code_repositories(tenant_id, created_at);
