-- Migration #055: Create ai_llm_traces table
-- AI Python Phase 1.3: Observability traces for LLM calls (distributed tracing)

CREATE TABLE IF NOT EXISTS ai_llm_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    trace_id VARCHAR(255) NOT NULL,
    parent_span_id VARCHAR(255) DEFAULT '',
    span_id VARCHAR(255) NOT NULL,
    span_name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(64) NOT NULL,
    model VARCHAR(255) DEFAULT '',
    input TEXT DEFAULT '',
    output TEXT DEFAULT '',
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'ok',  -- ok, error, timeout
    error_message TEXT DEFAULT '',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_llm_traces_tenant ON ai_llm_traces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_llm_traces_trace_id ON ai_llm_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_llm_traces_span_id ON ai_llm_traces(span_id);
CREATE INDEX IF NOT EXISTS idx_ai_llm_traces_provider ON ai_llm_traces(provider_type);
CREATE INDEX IF NOT EXISTS idx_ai_llm_traces_status ON ai_llm_traces(status);
CREATE INDEX IF NOT EXISTS idx_ai_llm_traces_started ON ai_llm_traces(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_llm_traces_tenant_trace ON ai_llm_traces(tenant_id, trace_id);