-- Ai-Cost module tables (auto-generated)

CREATE TABLE IF NOT EXISTS cost_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    prompt_tokens BIGINT NOT NULL,
    completion_tokens BIGINT NOT NULL,
    cost DOUBLE PRECISION NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_cost_records_tenant ON cost_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_created ON cost_records(created_at DESC);

