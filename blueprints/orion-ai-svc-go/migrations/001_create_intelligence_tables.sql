CREATE TABLE IF NOT EXISTS intelligence_tasks (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	insight_type VARCHAR(64) NOT NULL, source VARCHAR(128) NOT NULL, confidence DOUBLE PRECISION NOT NULL DEFAULT 0, data JSONB NOT NULL DEFAULT '{}', status VARCHAR(32) NOT NULL DEFAULT 'pending',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_intelligence_tasks_tenant ON intelligence_tasks(tenant_id, created_at);
