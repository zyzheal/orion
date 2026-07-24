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

CREATE INDEX IF NOT EXISTS idx_data_pipelines_tenant ON data_pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_pipelines_status ON data_pipelines(tenant_id, status);