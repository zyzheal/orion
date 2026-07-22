-- Migration 364: Config Fallback Persistence
-- Migrates config_fallback from in-memory cache to PostgreSQL

CREATE TABLE IF NOT EXISTS config_fallback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          VARCHAR(100) NOT NULL,
  key             VARCHAR(200) NOT NULL,
  fallback_value  JSONB NOT NULL DEFAULT '{}',
  priority        INTEGER NOT NULL DEFAULT 0,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  tenant_id       UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_config_fallback_domain ON config_fallback(domain);
CREATE INDEX idx_config_fallback_key ON config_fallback(key);
CREATE INDEX idx_config_fallback_tenant ON config_fallback(tenant_id);
CREATE INDEX idx_config_fallback_domain_key ON config_fallback(domain, key);
