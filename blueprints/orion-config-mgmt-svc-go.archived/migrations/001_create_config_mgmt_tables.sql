CREATE TABLE IF NOT EXISTS config_items (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	key VARCHAR(256) NOT NULL,
	value TEXT NOT NULL DEFAULT '',
	environment VARCHAR(64) NOT NULL DEFAULT 'production',
	version INT NOT NULL DEFAULT 1,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_config_items_tenant ON config_items(tenant_id, key);
