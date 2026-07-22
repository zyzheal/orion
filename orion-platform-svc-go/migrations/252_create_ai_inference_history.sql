-- Migration #252: Create ai_inference_history table
-- AI inference proxy: persist request/response history for audit & observability

CREATE TABLE IF NOT EXISTS ai_inference_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    service VARCHAR(64) NOT NULL,         -- "classify", "embedding", "anomaly"
    type VARCHAR(64) NOT NULL,            -- "inference" or "decision"
    model VARCHAR(255),
    input_type VARCHAR(64),               -- "image", "text", "data"
    request_payload JSONB,
    response_payload JSONB,
    success BOOLEAN DEFAULT true,
    error TEXT,
    duration_seconds NUMERIC(10, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_inference_history_tenant ON ai_inference_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_inference_history_created_at ON ai_inference_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_inference_history_type ON ai_inference_history(type);
CREATE INDEX IF NOT EXISTS idx_ai_inference_history_success ON ai_inference_history(success);
CREATE INDEX IF NOT EXISTS idx_ai_inference_history_tenant_created ON ai_inference_history(tenant_id, created_at DESC);
