CREATE TABLE IF NOT EXISTS llm_traces (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128),
    scenario_id VARCHAR(128),
    provider_id VARCHAR(128),
    model_id VARCHAR(128) NOT NULL,
    prompt_content TEXT,
    prompt_hash VARCHAR(64),
    output_content TEXT,
    output_hash VARCHAR(64),
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    input_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    output_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    request_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_completed_at TIMESTAMPTZ,
    duration_ms INT,
    parent_trace_id UUID,
    error_message TEXT,
    request_context JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_llm_traces_tenant ON llm_traces(tenant_id, request_started_at);
CREATE INDEX idx_llm_traces_model ON llm_traces(model_id, status);
CREATE INDEX idx_llm_traces_parent ON llm_traces(parent_trace_id);
