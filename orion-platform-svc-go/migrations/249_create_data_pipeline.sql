-- Migration #249: Create data_pipelines and data_pipeline_runs tables
-- Stores data pipeline definitions and their execution run history.

CREATE TABLE IF NOT EXISTS data_pipelines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    source_table VARCHAR(255) DEFAULT '',
    target_table VARCHAR(255) DEFAULT '',
    transformation_script TEXT DEFAULT '',
    schedule VARCHAR(100) DEFAULT '',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key to tenants table (tenant_id)
ALTER TABLE data_pipelines ADD CONSTRAINT fk_data_pipelines_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS data_pipeline_runs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    pipeline_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_message TEXT DEFAULT '',
    metrics_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key to tenants and pipelines
ALTER TABLE data_pipeline_runs ADD CONSTRAINT fk_data_pipeline_runs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE data_pipeline_runs ADD CONSTRAINT fk_data_pipeline_runs_pipeline
    FOREIGN KEY (pipeline_id) REFERENCES data_pipelines(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_pipelines_tenant ON data_pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_pipelines_status ON data_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_data_pipeline_runs_tenant ON data_pipeline_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_pipeline_runs_pipeline ON data_pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_data_pipeline_runs_status ON data_pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_data_pipeline_runs_created ON data_pipeline_runs(created_at DESC);
