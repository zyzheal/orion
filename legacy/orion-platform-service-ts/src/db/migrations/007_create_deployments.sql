-- Migration 007: Deployments
-- Deployment records and configurations

CREATE TABLE IF NOT EXISTS deployments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  build_id      UUID REFERENCES builds(id) ON DELETE SET NULL,
  environment   VARCHAR(100) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  strategy      VARCHAR(50) NOT NULL DEFAULT 'rolling',
  config        JSONB NOT NULL DEFAULT '{}',
  deployed_by   UUID REFERENCES users(id),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   BIGINT,
  error_message TEXT,
  rollback_to   UUID REFERENCES deployments(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deployments_tenant ON deployments(tenant_id);
CREATE INDEX idx_deployments_project ON deployments(project_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_env ON deployments(environment);

-- Deployment events (audit trail)
CREATE TABLE IF NOT EXISTS deployment_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  event_type    VARCHAR(50) NOT NULL,
  message       TEXT,
  actor_id      UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deployment_events_deployment ON deployment_events(deployment_id);

-- Rollback:
-- DROP TABLE IF EXISTS deployment_events, deployments;
