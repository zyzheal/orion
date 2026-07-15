-- Pipeline-Version module tables (auto-generated)

CREATE TABLE IF NOT EXISTS pipeline_versions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    yaml_definition VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    tags VARCHAR(255) NOT NULL,
    is_baseline BOOLEAN NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_pipeline_versions_tenant ON pipeline_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_versions_created ON pipeline_versions(created_at DESC);

