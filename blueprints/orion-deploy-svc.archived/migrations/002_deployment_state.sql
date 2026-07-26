-- Migration 002: Deployment State Persistence
-- Stores deploy execution state from memory Map to PostgreSQL

-- Deployment state table for tracking active deployments
CREATE TABLE IF NOT EXISTS deployment_state (
  id              VARCHAR(255) PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  project_id      UUID,
  environment_id  UUID,
  namespace       VARCHAR(100) NOT NULL,
  deployment_name VARCHAR(255) NOT NULL,
  status          VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'queued', 'deploying', 'deployed', 'failed', 'rolled_back', 'cancelled')),
  strategy        VARCHAR(50),
  image_tag       VARCHAR(200),
  commit_sha      VARCHAR(100),
  branch          VARCHAR(200),
  deployed_by     VARCHAR(200),
  rollout_history JSONB DEFAULT '[]',
  metadata        JSONB DEFAULT '{}',
  error_message   TEXT,
  rollback_target_id VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_deployment_state_tenant ON deployment_state(tenant_id);
CREATE INDEX idx_deployment_state_project ON deployment_state(project_id);
CREATE INDEX idx_deployment_state_environment ON deployment_state(environment_id);
CREATE INDEX idx_deployment_state_namespace ON deployment_state(namespace);
CREATE INDEX idx_deployment_state_status ON deployment_state(status);
CREATE INDEX idx_deployment_state_created ON deployment_state(created_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS deployment_state;