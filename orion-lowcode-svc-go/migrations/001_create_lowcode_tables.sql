CREATE TABLE IF NOT EXISTS lowcode_apps (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	component_type VARCHAR(64) NOT NULL, schema JSONB NOT NULL DEFAULT '{}', preview_url TEXT, version INT NOT NULL DEFAULT 1,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lowcode_apps_tenant ON lowcode_apps(tenant_id, created_at);
