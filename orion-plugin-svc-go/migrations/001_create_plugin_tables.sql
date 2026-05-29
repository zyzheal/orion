CREATE TABLE IF NOT EXISTS plugins (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	description TEXT, version VARCHAR(64) NOT NULL DEFAULT '0.1.0', author VARCHAR(128), enabled BOOLEAN NOT NULL DEFAULT true, config JSONB DEFAULT '{}', entrypoint TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_plugins_tenant ON plugins(tenant_id, created_at);
