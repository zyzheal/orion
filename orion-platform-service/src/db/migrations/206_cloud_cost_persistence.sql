-- Migration 206: Cloud cost collected resources persistence
-- Stores collected cloud resource cost data and collection schedules

CREATE TABLE IF NOT EXISTS cloud_cost_resources (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64),
  provider        VARCHAR(32) NOT NULL,
  resource_type   VARCHAR(32) NOT NULL,
  resource_id     VARCHAR(256) NOT NULL,
  resource_name   VARCHAR(256),
  region          VARCHAR(64) NOT NULL,
  cost            NUMERIC(14,2) NOT NULL,
  currency        VARCHAR(8) NOT NULL DEFAULT 'USD',
  tags            JSONB DEFAULT '{}',
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  environment     VARCHAR(64),
  billing_period  VARCHAR(256),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_cost_resources_tenant ON cloud_cost_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_cost_resources_provider ON cloud_cost_resources(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_cost_resources_type ON cloud_cost_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_cloud_cost_resources_ts ON cloud_cost_resources(timestamp);

CREATE TABLE IF NOT EXISTS cloud_cost_schedules (
  id                VARCHAR(64) PRIMARY KEY,
  tenant_id         VARCHAR(64),
  provider          VARCHAR(32) NOT NULL UNIQUE,
  cron_expression   VARCHAR(128) NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  last_collected_at TIMESTAMPTZ,
  last_status       VARCHAR(16),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_cost_schedules_tenant ON cloud_cost_schedules(tenant_id);
