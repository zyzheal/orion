-- Deployment Events: lifecycle event persistence for deployments
-- Task 4.32: Deployment event persistence — move deployment events from in-memory Map to PostgreSQL
--
-- Each row represents a lifecycle event for a deployment (started, completed, failed, etc.).
-- Tenant-isolated via RLS. Used by DeploySaga and DeploymentHistoryService.

CREATE TABLE IF NOT EXISTS deployment_events (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id     TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  event_type    VARCHAR(50) NOT NULL,
  message       TEXT NOT NULL,
  details       JSONB DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: tenant isolation
ALTER TABLE deployment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY deployment_events_tenant_isolation ON deployment_events
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- Performance: lookups by deployment_id
CREATE INDEX IF NOT EXISTS idx_deployment_events_deployment
  ON deployment_events (deployment_id);

-- Performance: tenant + time range queries
CREATE INDEX IF NOT EXISTS idx_deployment_events_tenant_created
  ON deployment_events (tenant_id, created_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS deployment_events CASCADE;
