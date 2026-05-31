-- Migration 229: Progressive Deployment Persistence
-- Stores active progressive deployment status for traffic shifting

CREATE TABLE IF NOT EXISTS progressive_deployments (
  id                      VARCHAR(100) PRIMARY KEY,
  deployment_id           VARCHAR(100) NOT NULL,
  tenant_id               VARCHAR(100) NOT NULL,
  phase                   VARCHAR(50) NOT NULL DEFAULT 'initial',
  strategy                VARCHAR(50) NOT NULL DEFAULT 'canary',
  current_traffic_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  target_traffic_percent  NUMERIC(5,2) NOT NULL DEFAULT 100,
  error_rate              NUMERIC(5,2) NOT NULL DEFAULT 0,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_increment_at       TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  config                  JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progressive_deployments_tenant ON progressive_deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_progressive_deployments_deployment ON progressive_deployments(deployment_id);
CREATE INDEX IF NOT EXISTS idx_progressive_deployments_phase ON progressive_deployments(phase);

-- Rollback:
-- DROP TABLE IF EXISTS progressive_deployments;
