-- Governance module tables (auto-generated)

CREATE TABLE IF NOT EXISTS governance_policies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    severity VARCHAR(255) NOT NULL,
    rules VARCHAR(255) NOT NULL,
    scope VARCHAR(255) NOT NULL,
    enforcement VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    applied_count BIGINT NOT NULL,
    violation_count BIGINT NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_governance_policies_tenant ON governance_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_governance_policies_created ON governance_policies(created_at DESC);

