-- Pipeline template library with categorization, versioning, and instantiation support.
CREATE TABLE IF NOT EXISTS pipeline_templates (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL DEFAULT 'custom',
    yaml_content TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '[]',
    version INT NOT NULL DEFAULT 1,
    is_public BOOLEAN NOT NULL DEFAULT false,
    tags JSONB NOT NULL DEFAULT '[]',
    usage_count INT NOT NULL DEFAULT 0,
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_tenant ON pipeline_templates(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_category ON pipeline_templates(category);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_tags ON pipeline_templates USING GIN(tags);

-- Referenced by instantiate-template which creates a pipeline from a template.
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64),
    name VARCHAR(256) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    config JSONB NOT NULL DEFAULT '{}',
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
