-- create_test generation_tables module tables (dedicated table)

CREATE TABLE IF NOT EXISTS test_generation_records (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'pending',
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_test_generation_records_tenant ON test_generation_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_generation_records_created ON test_generation_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_generation_records_status ON test_generation_records(tenant_id, status);
