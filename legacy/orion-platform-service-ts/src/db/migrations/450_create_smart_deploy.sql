-- ============================================================================
-- Task 2.16: SmartDeployService PostgreSQL persistence
-- ============================================================================
--
-- Migrate SmartDeployService active deployment runtime state from in-memory
-- Map to PostgreSQL. Historical records continue to use DeploymentHistoryRepository.
--
-- Table: smart_deploy_records
-- - Persists active deployment state (status, stages, current stage index)
-- - Stores canary config and metrics as JSONB
-- - Tenant-isolated via RLS + composite unique index on (tenant_id, deployment_id)

CREATE TABLE IF NOT EXISTS smart_deploy_records (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id      TEXT NOT NULL,
  deployment_id  TEXT NOT NULL,
  strategy       TEXT NOT NULL,
  state          JSONB NOT NULL DEFAULT '{}',
  canary_config  JSONB,
  metrics        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite unique: one active record per (tenant, deployment_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_smart_deploy_tenant_deployment
  ON smart_deploy_records (tenant_id, deployment_id);

-- Lookups by deployment_id (used by findByDeploymentId)
CREATE INDEX IF NOT EXISTS idx_smart_deploy_deployment_id
  ON smart_deploy_records (deployment_id);

-- Tenant + time queries (used by listActive, recovery)
CREATE INDEX IF NOT EXISTS idx_smart_deploy_tenant_created
  ON smart_deploy_records (tenant_id, created_at DESC);

-- GIN index for JSONB state queries (e.g., filtering by status in state->>'status')
CREATE INDEX IF NOT EXISTS idx_smart_deploy_state_status
  ON smart_deploy_records USING GIN (state);

-- RLS: tenant isolation
ALTER TABLE smart_deploy_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY smart_deploy_tenant_isolation ON smart_deploy_records
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- Rollback:
-- DROP TABLE IF EXISTS smart_deploy_records CASCADE;
