-- ============================================================================
-- Task 4.25: Config Webhook Notification Routes
-- ============================================================================
-- Config-level webhook subscriptions allow tenants to register HTTP endpoints
-- that receive notifications when config events occur (changed, synced, etc.).
-- Tenant-isolated via RLS. Delivered via ConfigWebhookService.

-- ---------------------------------------------------------------------------
-- config_webhooks: subscription registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config_webhooks (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id     TEXT NOT NULL,
  url           TEXT NOT NULL,
  events        JSONB DEFAULT '[]'::JSONB,
  secret        TEXT,
  headers       JSONB DEFAULT '{}'::JSONB,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION fn_set_config_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_config_webhooks_updated_at ON config_webhooks;
CREATE TRIGGER trg_config_webhooks_updated_at
  BEFORE UPDATE ON config_webhooks
  FOR EACH ROW EXECUTE FUNCTION fn_set_config_webhooks_updated_at();

-- RLS
ALTER TABLE config_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_webhooks_tenant_isolation ON config_webhooks
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_config_webhooks_tenant
  ON config_webhooks (tenant_id);

CREATE INDEX IF NOT EXISTS idx_config_webhooks_tenant_created
  ON config_webhooks (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- config_webhook_deliveries: delivery history for retry/debug
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config_webhook_deliveries (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  webhook_id      TEXT NOT NULL REFERENCES config_webhooks(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB DEFAULT '{}'::JSONB,
  status          TEXT NOT NULL DEFAULT 'pending',
  attempt         INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  response_status INTEGER,
  response_body   TEXT,
  error_message   TEXT,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_webhook_deliveries_webhook
  ON config_webhook_deliveries (webhook_id);

CREATE INDEX IF NOT EXISTS idx_config_webhook_deliveries_status
  ON config_webhook_deliveries (status, next_retry_at)
  WHERE status IN ('pending', 'retrying');

ALTER TABLE config_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Delivery access is via FK through webhook row, which is tenant-gated.

-- ============================================================================
-- Rollback:
-- DROP TABLE IF EXISTS config_webhook_deliveries CASCADE;
-- DROP TABLE IF EXISTS config_webhooks CASCADE;
-- DROP TRIGGER IF EXISTS trg_config_webhooks_updated_at ON config_webhooks;
-- DROP FUNCTION IF EXISTS fn_set_config_webhooks_updated_at();
-- ============================================================================
