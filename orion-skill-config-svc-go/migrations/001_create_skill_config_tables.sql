CREATE TABLE IF NOT EXISTS skill_configs (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	skill_id VARCHAR(128) NOT NULL, config_key VARCHAR(256) NOT NULL, config_value TEXT NOT NULL, environment VARCHAR(32) NOT NULL DEFAULT 'production',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_skill_configs_tenant ON skill_configs(tenant_id, created_at);
