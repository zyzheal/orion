-- Migration 139: Deployment Strategies
-- Defines reusable progressive deployment strategies
-- (canary, blue-green, rolling) for pipeline deployment stages.

CREATE TABLE IF NOT EXISTS deployment_strategies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  name        VARCHAR(200) NOT NULL,
  type        VARCHAR(20) NOT NULL,  -- 'canary', 'bluegreen', 'rolling'
  config      JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_deployment_strategies_tenant ON deployment_strategies(tenant_id);
CREATE INDEX idx_deployment_strategies_type ON deployment_strategies(type);
CREATE INDEX idx_deployment_strategies_tenant_type ON deployment_strategies(tenant_id, type);

-- Unique constraint: strategy name must be unique within a tenant
CREATE UNIQUE INDEX idx_deployment_strategies_tenant_name ON deployment_strategies(tenant_id, name);

-- Rollback:
-- DROP INDEX IF EXISTS idx_deployment_strategies_tenant_name;
-- DROP INDEX IF EXISTS idx_deployment_strategies_tenant_type;
-- DROP INDEX IF EXISTS idx_deployment_strategies_type;
-- DROP INDEX IF EXISTS idx_deployment_strategies_tenant;
-- DROP TABLE IF EXISTS deployment_strategies;
