-- Migration 290: WebhookService Map() to PostgreSQL
-- Migrates webhookSecrets (repoId -> secret) and eventLog from in-memory storage

CREATE TABLE IF NOT EXISTS webhook_secrets (
  id VARCHAR(100) PRIMARY KEY,
  repo_id VARCHAR(200) NOT NULL,
  secret VARCHAR(500) NOT NULL,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_secrets_repo_id ON webhook_secrets(repo_id);
CREATE INDEX IF NOT EXISTS idx_webhook_secrets_tenant ON webhook_secrets(tenant_id);

CREATE TABLE IF NOT EXISTS webhook_event_log (
  id VARCHAR(100) PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  repo_type VARCHAR(50) NOT NULL,
  repo_name VARCHAR(200),
  event_id VARCHAR(200),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error TEXT,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_log_event_type ON webhook_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_event_log_repo_type ON webhook_event_log(repo_type);
CREATE INDEX IF NOT EXISTS idx_webhook_event_log_created_at ON webhook_event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_event_log_tenant ON webhook_event_log(tenant_id);
