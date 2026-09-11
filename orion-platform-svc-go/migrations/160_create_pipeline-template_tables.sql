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
    deleted_at TIMESTAMP WITH TIME ZONE
);
-- 补齐 pipeline_templates：161_create_pipeline-templates_tables.sql 的定义晚于 160_create_pipeline-template_tables.sql，按序执行时表已存在
ALTER TABLE pipeline_templates ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS status VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS visibility VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS author VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS organization VARCHAR(255), ADD COLUMN IF NOT EXISTS config VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS parameters VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS readme VARCHAR(255), ADD COLUMN IF NOT EXISTS icon VARCHAR(255), ADD COLUMN IF NOT EXISTS usage_count BIGINT NOT NULL, ADD COLUMN IF NOT EXISTS star_count BIGINT NOT NULL, ADD COLUMN IF NOT EXISTS published_at BIGINT;


CREATE INDEX IF NOT EXISTS idx_pipeline_templates_tenant ON pipeline_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_created ON pipeline_templates(created_at DESC);

