-- 054: AI 代码审查表
CREATE TABLE IF NOT EXISTS ai_reviews (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    context JSONB,
    reviewers JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    summary TEXT,
    comments JSONB NOT NULL DEFAULT '[]',
    score REAL DEFAULT 0.0,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_reviews_status_tenant
    ON ai_reviews(status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_language_tenant
    ON ai_reviews(language, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_tenant_created
    ON ai_reviews(tenant_id, created_at DESC);
