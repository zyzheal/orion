-- Migration 022: API Keys & Rate Limiting
-- API key management and rate limit tracking

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  key_hash      VARCHAR(128) NOT NULL UNIQUE,
  permissions   JSONB NOT NULL DEFAULT '{}',
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);

-- Rate limit counters
CREATE TABLE IF NOT EXISTS rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash      VARCHAR(128) NOT NULL,
  endpoint      VARCHAR(200) NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, endpoint, window_start)
);

-- Rollback:
-- DROP TABLE IF EXISTS rate_limits, api_keys;
