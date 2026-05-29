CREATE TABLE IF NOT EXISTS inception_projects (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	experiment_type VARCHAR(64) NOT NULL, hypothesis TEXT NOT NULL, result TEXT, status VARCHAR(32) NOT NULL DEFAULT 'pending', metrics JSONB DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inception_projects_tenant ON inception_projects(tenant_id, created_at);
