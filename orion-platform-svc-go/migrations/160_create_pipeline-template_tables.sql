-- Pipeline-Template module tables (auto-generated)

CREATE TABLE IF NOT EXISTS pipeline_templates (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    yaml_definition VARCHAR(255) NOT NULL,
    tags VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    version VARCHAR(255),
    created_by VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_pipeline_templates_tenant ON pipeline_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_created ON pipeline_templates(created_at DESC);

