-- create_autonomous pipeline_tables module tables (dedicated table)

CREATE TABLE IF NOT EXISTS autonomous_pipeline_records (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'active',
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_autonomous_pipeline_records_tenant ON autonomous_pipeline_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_pipeline_records_created ON autonomous_pipeline_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autonomous_pipeline_records_status ON autonomous_pipeline_records(tenant_id, status);
