-- Migration 136: Pipeline Webhook Configurations
-- Per-pipeline outbound webhook notification settings

CREATE TABLE IF NOT EXISTS pipeline_webhook_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id   VARCHAR(200) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  url           VARCHAR(500) NOT NULL,
  method        VARCHAR(10) NOT NULL DEFAULT 'POST',
  headers       JSONB NOT NULL DEFAULT '{}',
  secret        VARCHAR(255),
  events        VARCHAR(50)[] NOT NULL DEFAULT '{}',
  enabled       BOOLEAN NOT NULL DEFAULT true,
  retries       INT NOT NULL DEFAULT 3,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_configs_pipeline ON pipeline_webhook_configs(pipeline_id);
CREATE INDEX idx_webhook_configs_enabled ON pipeline_webhook_configs(enabled);

-- Rollback:
-- DROP TABLE IF EXISTS pipeline_webhook_configs;
