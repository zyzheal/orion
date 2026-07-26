CREATE TABLE IF NOT EXISTS config_versions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    config_id UUID NOT NULL REFERENCES config_items(id) ON DELETE CASCADE,
    config_key VARCHAR(256) NOT NULL,
    environment VARCHAR(64) NOT NULL DEFAULT 'production',
    value TEXT NOT NULL DEFAULT '',
    version_number INT NOT NULL,
    change_type VARCHAR(32) NOT NULL DEFAULT 'update',
    changed_by VARCHAR(128),
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_config_versions_tenant_key ON config_versions(tenant_id, config_key, environment);
CREATE INDEX idx_config_versions_config_id ON config_versions(config_id);
