-- Migration 282: AIDegradationRouter Map() to PostgreSQL
-- Migrates degradationConfigs and resultCache from in-memory Map storage

CREATE TABLE IF NOT EXISTS ai_degradation_configs (
  id VARCHAR(100) PRIMARY KEY,
  scenario VARCHAR(100) NOT NULL UNIQUE,
  strategy VARCHAR(50) NOT NULL DEFAULT 'default',
  fallback_strategies JSONB NOT NULL DEFAULT '[]',
  rule_set VARCHAR(100),
  template_name VARCHAR(100),
  cache_ttl BIGINT NOT NULL DEFAULT 300000,
  notify_on_degradation BOOLEAN NOT NULL DEFAULT false,
  default_response JSONB,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_degradation_configs_scenario ON ai_degradation_configs(scenario);
CREATE INDEX IF NOT EXISTS idx_ai_degradation_configs_tenant ON ai_degradation_configs(tenant_id);

CREATE TABLE IF NOT EXISTS ai_degradation_result_cache (
  id VARCHAR(100) PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL UNIQUE,
  scenario VARCHAR(100) NOT NULL,
  result_json JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMP NOT NULL,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_degradation_result_cache_key ON ai_degradation_result_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_degradation_result_cache_scenario ON ai_degradation_result_cache(scenario);
CREATE INDEX IF NOT EXISTS idx_ai_degradation_result_cache_expires ON ai_degradation_result_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_degradation_result_cache_tenant ON ai_degradation_result_cache(tenant_id);
