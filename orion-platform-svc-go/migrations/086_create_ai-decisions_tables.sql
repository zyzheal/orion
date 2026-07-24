-- Ai-Decisions module tables (auto-generated)

CREATE TABLE IF NOT EXISTS a_i_decisions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    type VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    input VARCHAR(255) NOT NULL,
    output VARCHAR(255) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    model_version VARCHAR(255) NOT NULL,
    reasoning VARCHAR(255) NOT NULL,
    context VARCHAR(255) NOT NULL,
    impact VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    executed_at VARCHAR(255) NOT NULL,
    expires_at VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_a_i_decisions_tenant ON a_i_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a_i_decisions_created ON a_i_decisions(created_at DESC);

CREATE TABLE IF NOT EXISTS decision_feedbacks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    decision_id VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    comment VARCHAR(255) NOT NULL,
    outcome VARCHAR(255) NOT NULL,
    actual_impact VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_decision_feedbacks_tenant ON decision_feedbacks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decision_feedbacks_created ON decision_feedbacks(created_at DESC);

CREATE TABLE IF NOT EXISTS decision_traces (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    decision_id VARCHAR(255) NOT NULL,
    step BIGINT NOT NULL,
    action VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    input VARCHAR(255) NOT NULL,
    output VARCHAR(255) NOT NULL,
    duration BIGINT NOT NULL,
    timestamp BIGINT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_decision_traces_tenant ON decision_traces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decision_traces_created ON decision_traces(created_at DESC);

