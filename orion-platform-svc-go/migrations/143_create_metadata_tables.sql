-- create_metadata_tables module tables (dedicated table)

CREATE TABLE IF NOT EXISTS metadata_records (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'active',
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_metadata_records_tenant ON metadata_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metadata_records_created ON metadata_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metadata_records_status ON metadata_records(tenant_id, status);
