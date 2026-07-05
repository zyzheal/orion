-- 051: AI 分析结果表
CREATE TABLE IF NOT EXISTS ai_analyses (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    result JSONB NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 0.0,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_type_tenant
    ON ai_analyses(type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_tenant_created
    ON ai_analyses(tenant_id, created_at DESC);
