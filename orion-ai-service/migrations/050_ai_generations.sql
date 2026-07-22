-- 050: AI 生成结果表
CREATE TABLE IF NOT EXISTS ai_generations (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    context JSONB,
    model TEXT,
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_tenant_created
    ON ai_generations(tenant_id, created_at DESC);
