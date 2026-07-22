-- Migration #052: Create ai_generation_logs table
-- AI Python Phase 1.3: Log all LLM generation requests and responses

CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    provider_type VARCHAR(64) NOT NULL,
    model VARCHAR(255) NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'success',  -- success, error, timeout, cancelled
    error_message TEXT DEFAULT '',
    request_config JSONB DEFAULT '{}',
    response_metadata JSONB DEFAULT '{}',
    trace_id VARCHAR(255) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_tenant ON ai_generation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_provider ON ai_generation_logs(provider_type);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_model ON ai_generation_logs(model);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_status ON ai_generation_logs(status);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_trace ON ai_generation_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created ON ai_generation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_tenant_created ON ai_generation_logs(tenant_id, created_at DESC);