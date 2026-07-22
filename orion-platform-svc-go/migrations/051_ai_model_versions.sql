-- Migration #051: Create ai_model_versions table
-- AI Python Phase 1.3: Track model versions and their lifecycle status

CREATE TABLE IF NOT EXISTS ai_model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    version VARCHAR(64) NOT NULL,
    provider_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending, active, deprecated, archived
    metadata JSONB DEFAULT '{}',
    artifact_path TEXT DEFAULT '',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_model_versions_tenant ON ai_model_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_versions_name ON ai_model_versions(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_model_versions_status ON ai_model_versions(status);
CREATE INDEX IF NOT EXISTS idx_ai_model_versions_tenant_status ON ai_model_versions(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_versions_uniq ON ai_model_versions(tenant_id, model_name, version);