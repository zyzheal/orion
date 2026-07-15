-- Decision-Explanation module tables (auto-generated)

CREATE TABLE IF NOT EXISTS decision_explanations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_decision_explanations_tenant ON decision_explanations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decision_explanations_created ON decision_explanations(created_at DESC);

