-- Migration #237: Create data_pipelines table
-- Stores data pipeline definitions for ETL/ELT workflow orchestration.

CREATE TABLE IF NOT EXISTS data_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
-- 补齐 data_pipelines：249_create_data_pipeline.sql 的定义晚于 237_create_data_pipelines_table.sql，按序执行时表已存在
ALTER TABLE data_pipelines ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '', ADD COLUMN IF NOT EXISTS source_table VARCHAR(255) DEFAULT '', ADD COLUMN IF NOT EXISTS target_table VARCHAR(255) DEFAULT '', ADD COLUMN IF NOT EXISTS transformation_script TEXT DEFAULT '', ADD COLUMN IF NOT EXISTS schedule VARCHAR(100) DEFAULT '';


CREATE INDEX IF NOT EXISTS idx_data_pipelines_tenant ON data_pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_pipelines_status ON data_pipelines(tenant_id, status);