CREATE TABLE IF NOT EXISTS runners (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	type VARCHAR(32) NOT NULL DEFAULT 'docker', status VARCHAR(32) NOT NULL DEFAULT 'idle', endpoint TEXT, capacity INT NOT NULL DEFAULT 1, labels JSONB DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_runners_tenant ON runners(tenant_id, created_at);
