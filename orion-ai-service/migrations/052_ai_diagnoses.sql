-- 052: AI 诊断结果表
CREATE TABLE IF NOT EXISTS ai_diagnoses (
    id TEXT PRIMARY KEY,
    symptoms JSONB NOT NULL DEFAULT '[]',
    context JSONB,
    diagnosis TEXT NOT NULL,
    severity TEXT NOT NULL,
    recommendations JSONB NOT NULL DEFAULT '[]',
    tenant_id TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_severity_tenant
    ON ai_diagnoses(severity, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_tenant_created
    ON ai_diagnoses(tenant_id, created_at DESC);
