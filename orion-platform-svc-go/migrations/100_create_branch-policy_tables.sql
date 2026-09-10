-- Branch-Policy module tables (dedicated table)

CREATE TABLE IF NOT EXISTS branch_policy_records (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'active',
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_branch_policy_records_tenant ON branch_policy_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_policy_records_created ON branch_policy_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branch_policy_records_status ON branch_policy_records(tenant_id, status);
