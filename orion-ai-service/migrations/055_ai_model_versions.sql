-- 055: AI 模型版本表
CREATE TABLE IF NOT EXISTS ai_model_versions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    config JSONB,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_versions_name_provider
    ON ai_model_versions(name, provider, version);
CREATE INDEX IF NOT EXISTS idx_ai_model_versions_tenant_status
    ON ai_model_versions(tenant_id, status);
