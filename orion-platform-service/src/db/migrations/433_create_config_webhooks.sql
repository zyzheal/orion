-- ============================================================
-- Config Webhooks
-- Migration: 433
-- ============================================================
-- Purpose:
--   - Store config change webhook registrations
--   - When config changes occur, registered webhooks receive
--     HTTP POST notifications with change event data
-- ============================================================

CREATE TABLE IF NOT EXISTS config_webhooks (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  url             TEXT NOT NULL,
  method          TEXT NOT NULL DEFAULT 'POST',
  headers         JSONB DEFAULT '{}',
  secret          TEXT,
  event_types     TEXT[] DEFAULT '{}',
  domains         TEXT[] DEFAULT '{}',
  enabled         BOOLEAN DEFAULT true,
  retry_count     INT DEFAULT 3,
  timeout_ms      INT DEFAULT 10000,
  created_by      TEXT NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_webhooks_tenant
  ON config_webhooks (tenant_id);

CREATE INDEX IF NOT EXISTS idx_config_webhooks_tenant_enabled
  ON config_webhooks (tenant_id, enabled);

CREATE INDEX IF NOT EXISTS idx_config_webhooks_event_types
  ON config_webhooks USING GIN (event_types);
