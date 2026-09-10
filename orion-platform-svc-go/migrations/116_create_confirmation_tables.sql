-- create_confirmation_tables module tables (dedicated table)

CREATE TABLE IF NOT EXISTS confirmation_records (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'pending',
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_confirmation_records_tenant ON confirmation_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_records_created ON confirmation_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confirmation_records_status ON confirmation_records(tenant_id, status);
