-- Migration #050: Create ai_llm_providers table
-- AI Python Phase 1.3: LLM provider configuration and credential management

CREATE TABLE IF NOT EXISTS ai_llm_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(64) NOT NULL,
    api_key_encrypted TEXT,
    endpoint TEXT,
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_llm_providers_tenant ON ai_llm_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_llm_providers_type ON ai_llm_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_ai_llm_providers_enabled ON ai_llm_providers(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_llm_providers_tenant_enabled ON ai_llm_providers(tenant_id, enabled);