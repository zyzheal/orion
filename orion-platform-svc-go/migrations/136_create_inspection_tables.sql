-- Inspection module tables (dedicated table to avoid the shared `records` collision)

CREATE TABLE IF NOT EXISTS inspection_records (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'pending',
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_inspection_records_tenant ON inspection_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspection_records_created ON inspection_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_records_status ON inspection_records(tenant_id, status);

