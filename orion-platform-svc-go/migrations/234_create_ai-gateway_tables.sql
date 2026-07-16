-- Migration #234: Create ai_gateway_requests table
-- Stores AI model request/response logs for gateway operations.

CREATE TABLE IF NOT EXISTS ai_gateway_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    provider VARCHAR(255),
    input TEXT NOT NULL,
    output TEXT,
    tokens INTEGER DEFAULT 0,
    latency_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_gateway_requests_tenant ON ai_gateway_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_requests_model ON ai_gateway_requests(tenant_id, model);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_requests_provider ON ai_gateway_requests(tenant_id, provider);
