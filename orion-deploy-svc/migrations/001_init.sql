-- Migration 001: Deploy Service Initialization
-- Core deployment, environment, and rollback tables

-- Environments table (independent deployment targets)
CREATE TABLE IF NOT EXISTS deploy_environments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(50) NOT NULL CHECK (type IN ('development', 'staging', 'production', 'canary')),
  cluster_url     VARCHAR(500) NOT NULL,
  namespace       VARCHAR(200) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_deploy_environments_tenant ON deploy_environments(tenant_id);
CREATE INDEX idx_deploy_environments_type ON deploy_environments(type);
CREATE INDEX idx_deploy_environments_active ON deploy_environments(is_active);

-- Deployments table (deployment records)
CREATE TABLE IF NOT EXISTS deploy_deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  project_id      UUID,
  pipeline_run_id UUID,
  build_id        UUID,
  environment_id  UUID REFERENCES deploy_environments(id) ON DELETE SET NULL,
  environment     VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'rolled_back', 'cancelled')),
  strategy        VARCHAR(50) NOT NULL DEFAULT 'rolling' CHECK (strategy IN ('rolling', 'blue_green', 'canary', 'recreate', 'direct')),
  config          JSONB NOT NULL DEFAULT '{}',
  deployed_by     VARCHAR(200),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     BIGINT,
  error_message   TEXT,
  rollback_to     UUID REFERENCES deploy_deployments(id),
  commit_sha      VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deploy_deployments_tenant ON deploy_deployments(tenant_id);
CREATE INDEX idx_deploy_deployments_project ON deploy_deployments(project_id);
CREATE INDEX idx_deploy_deployments_status ON deploy_deployments(status);
CREATE INDEX idx_deploy_deployments_environment ON deploy_deployments(environment);
CREATE INDEX idx_deploy_deployments_environment_id ON deploy_deployments(environment_id);
CREATE INDEX idx_deploy_deployments_pipeline_run ON deploy_deployments(pipeline_run_id);
CREATE INDEX idx_deploy_deployments_created ON deploy_deployments(created_at DESC);

-- Deployment events (audit trail)
CREATE TABLE IF NOT EXISTS deploy_deployment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   UUID NOT NULL REFERENCES deploy_deployments(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL CHECK (event_type IN ('started', 'progress', 'completed', 'failed', 'rolled_back', 'cancelled', 'canary_progress')),
  message         TEXT,
  actor           VARCHAR(200),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deploy_deployment_events_deployment ON deploy_deployment_events(deployment_id);
CREATE INDEX idx_deploy_deployment_events_type ON deploy_deployment_events(event_type);
CREATE INDEX idx_deploy_deployment_events_created ON deploy_deployment_events(created_at DESC);

-- Rollbacks table
CREATE TABLE IF NOT EXISTS deploy_rollbacks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id     UUID NOT NULL REFERENCES deploy_deployments(id) ON DELETE CASCADE,
  rollback_type     VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (rollback_type IN ('manual', 'automatic', 'canary_failed')),
  reason            TEXT,
  triggered_by      VARCHAR(200) NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
  previous_version  VARCHAR(200),
  target_version    VARCHAR(200),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deploy_rollbacks_deployment ON deploy_rollbacks(deployment_id);
CREATE INDEX idx_deploy_rollbacks_status ON deploy_rollbacks(status);
CREATE INDEX idx_deploy_rollbacks_created ON deploy_rollbacks(created_at DESC);

-- Canary analysis results
CREATE TABLE IF NOT EXISTS deploy_canary_analysis (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id     UUID NOT NULL REFERENCES deploy_deployments(id) ON DELETE CASCADE,
  analysis_type     VARCHAR(50) NOT NULL CHECK (analysis_type IN ('pre_deployment', 'post_deployment', 'during_rollout')),
  metric_name       VARCHAR(200) NOT NULL,
  baseline_value    VARCHAR(100),
  canary_value      VARCHAR(100),
  threshold         VARCHAR(100),
  result            VARCHAR(20) NOT NULL CHECK (result IN ('pass', 'fail', 'warning', 'pending')),
  message           TEXT,
  metadata          JSONB,
  analyzed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deploy_canary_analysis_deployment ON deploy_canary_analysis(deployment_id);
CREATE INDEX idx_deploy_canary_analysis_result ON deploy_canary_analysis(result);

-- Deployment strategies configuration
CREATE TABLE IF NOT EXISTS deploy_strategies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(100) NOT NULL,
  strategy_type     VARCHAR(50) NOT NULL CHECK (strategy_type IN ('rolling', 'blue_green', 'canary', 'recreate')),
  config            JSONB NOT NULL DEFAULT '{}',
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_deploy_strategies_tenant ON deploy_strategies(tenant_id);

-- Rollback:
-- DROP TABLE IF EXISTS deploy_canary_analysis, deploy_strategies, deploy_rollbacks, deploy_deployment_events, deploy_deployments, deploy_environments;