-- Migration 001: Create LLM trace tables
-- Date: 2026-05-26

CREATE TABLE IF NOT EXISTS llm_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    trace_id VARCHAR(64),
    model VARCHAR(100),
    prompt TEXT,
    response TEXT,
    tokens_used INTEGER,
    cost DECIMAL(10,4),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_traces_tenant ON llm_traces(tenant_id);
CREATE INDEX idx_traces_trace_id ON llm_traces(trace_id);
CREATE INDEX idx_traces_model ON llm_traces(model);
CREATE INDEX idx_traces_created_at ON llm_traces(created_at);
