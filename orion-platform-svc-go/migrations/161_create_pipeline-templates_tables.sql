-- Pipeline-Templates module tables (auto-generated)

CREATE TABLE IF NOT EXISTS pipeline_templates (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    tags VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    visibility VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    config VARCHAR(255) NOT NULL,
    parameters VARCHAR(255) NOT NULL,
    readme VARCHAR(255),
    icon VARCHAR(255),
    usage_count BIGINT NOT NULL,
    star_count BIGINT NOT NULL,
    published_at BIGINT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_pipeline_templates_tenant ON pipeline_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_created ON pipeline_templates(created_at DESC);

