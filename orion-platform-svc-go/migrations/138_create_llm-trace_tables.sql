-- Llm-Trace module tables (auto-generated)

CREATE TABLE IF NOT EXISTS l_l_m_traces (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    scenario_id VARCHAR(255) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    prompt_content VARCHAR(255) NOT NULL,
    prompt_hash VARCHAR(255) NOT NULL,
    output_content VARCHAR(255) NOT NULL,
    output_hash VARCHAR(255) NOT NULL,
    input_tokens BIGINT NOT NULL,
    output_tokens BIGINT NOT NULL,
    total_tokens BIGINT NOT NULL,
    input_cost DOUBLE PRECISION NOT NULL,
    output_cost DOUBLE PRECISION NOT NULL,
    total_cost DOUBLE PRECISION NOT NULL,
    currency VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    request_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    request_completed_at VARCHAR(255) NOT NULL,
    duration_ms VARCHAR(255) NOT NULL,
    parent_trace_id VARCHAR(255) NOT NULL,
    error_message VARCHAR(255) NOT NULL,
    request_context VARCHAR(255) NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_l_l_m_traces_tenant ON l_l_m_traces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_l_l_m_traces_created ON l_l_m_traces(created_at DESC);

