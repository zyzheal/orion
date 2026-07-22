-- Pipeline-Versions module tables (auto-generated)

CREATE TABLE IF NOT EXISTS versions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    config VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    is_default BOOLEAN NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    change_log VARCHAR(255),
    tags VARCHAR(255) NOT NULL,
    parent_version_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_versions_tenant ON versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_versions_created ON versions(created_at DESC);

