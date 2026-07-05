-- 053: AI 决策表
CREATE TABLE IF NOT EXISTS ai_decisions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    recommendation TEXT,
    confidence REAL DEFAULT 0.0,
    context JSONB,
    options JSONB,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_status_tenant
    ON ai_decisions(status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_tenant_created
    ON ai_decisions(tenant_id, created_at DESC);
