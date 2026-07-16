-- Migration 423: Canary Config Deployments
-- Supports canary (gradual) deployment of configuration changes

CREATE TABLE IF NOT EXISTS canary_deployments (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  config_id VARCHAR(100) NOT NULL REFERENCES config_entries(id) ON DELETE CASCADE,
  config_key VARCHAR(200) NOT NULL,
  environment VARCHAR(50) NOT NULL DEFAULT 'dev',
  percentage INT NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  old_value JSONB,
  canary_value JSONB,
  target_value JSONB,
  promoted_at TIMESTAMP,
  rolled_back_at TIMESTAMP,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_deployments_tenant ON canary_deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_canary_deployments_config ON canary_deployments(config_id);
CREATE INDEX IF NOT EXISTS idx_canary_deployments_status ON canary_deployments(status);
CREATE INDEX IF NOT EXISTS idx_canary_deployments_tenant_status ON canary_deployments(tenant_id, status);

CREATE TABLE IF NOT EXISTS canary_deployment_history (
  id VARCHAR(100) PRIMARY KEY,
  deployment_id VARCHAR(100) NOT NULL REFERENCES canary_deployments(id) ON DELETE CASCADE,
  old_percentage INT NOT NULL,
  new_percentage INT NOT NULL,
  action VARCHAR(30) NOT NULL,
  performed_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_deployment_history_deployment ON canary_deployment_history(deployment_id);

-- Rollback:
-- DROP TABLE IF EXISTS canary_deployment_history, canary_deployments;
