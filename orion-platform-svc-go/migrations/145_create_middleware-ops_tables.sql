-- create_middleware ops_tables module tables (dedicated table)

CREATE TABLE IF NOT EXISTS middleware_ops_records (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'active',
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_middleware_ops_records_tenant ON middleware_ops_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_middleware_ops_records_created ON middleware_ops_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_middleware_ops_records_status ON middleware_ops_records(tenant_id, status);
