-- Migration 455: Add encrypted columns for webhook secrets
--
-- Adds encrypted variants of sensitive columns in webhooks and webhook_endpoints.
-- The application layer will write to the _encrypted columns and read from them,
-- with transparent fallback to the legacy plaintext columns for backfill compatibility.

-- webhooks: add encrypted secret column
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS secret_encrypted TEXT;

-- webhook_endpoints: add encrypted secret column
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS secret_encrypted TEXT;

-- webhook_endpoints: add encrypted auth_config column
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS auth_config_encrypted TEXT;

-- Indexes for encrypted columns (used in WHERE clauses during lookups if needed)
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_encrypted ON webhooks(tenant_id) WHERE secret_encrypted IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_status_encrypted ON webhook_endpoints(status) WHERE secret_encrypted IS NOT NULL;
