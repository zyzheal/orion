-- Plugin-Hotreload module tables (auto-generated)

CREATE TABLE IF NOT EXISTS plugin_hotreloads (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_plugin_hotreloads_tenant ON plugin_hotreloads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_hotreloads_created ON plugin_hotreloads(created_at DESC);

